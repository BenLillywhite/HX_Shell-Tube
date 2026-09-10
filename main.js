import { createApp, ref, onMounted, watch, nextTick } from 'vue';
import { HeatExchangerEngine } from './engine.js?v=20260906_v2';
import { Renderer } from './render.js?v=20260906';
import { MaterialDatabase } from './database.js?v=20260906';

const App = {
    setup() {
        const openPanels = ref({
            shell: false,
            tube: false,
            hxSettings: false,
            hotFluid: false,
            coldFluid: false
        });

        const showGraphs = ref(false);
        const showAbout = ref(false);
        const showConfigPanel = ref(window.innerWidth >= 1200);
        const showResultsPanel = ref(window.innerWidth >= 1200);
        const unitSystem = ref('SI');
        const calculationMethod = ref('NTU');

        const getDefaultConfig = (method = 'NTU') => {
            const defaultConfig = {
                customU: 800,
                shell: {
                    passes: 1,
                    diameter: 0.4572, // meters (18" Nominal)
                },
                tube: {
                    passes: 1,     // Standard single pass by default
                    flowArrangement: 'counter', // 'counter' or 'parallel'
                    tubesPerPass: 16, // Tubes per pass
                    length: 2.0,   // meters
                    outerDiameter: 0.02, // meters
                    material: 'Carbon Steel',
                    k_material: 45.0
                },
                hotFluid: {
                    tempIn: 70,
                    massFlow: 1.8,
                    cp: 2.090
                },
                coldFluid: {
                    tempIn: 50,
                    massFlow: 2.5,
                    cp: 4.181
                }
            };

            if (method === 'LMTD') {
                // Physically valid defaults: hot outlet stays above cold inlet, hot inlet stays above cold outlet
                defaultConfig.hotFluid.tempIn = 150;
                defaultConfig.hotFluid.tempOut = 100;
                defaultConfig.coldFluid.tempIn = 20;
                defaultConfig.coldFluid.tempOut = 38;
                defaultConfig.lmtdKnownFluid = 'hot';
                defaultConfig.hxType = '1-1';
                defaultConfig.manualFFactor = 0.85;
            }

            return defaultConfig;
        };

        let savedMethodConfigs = {
            NTU: getDefaultConfig('NTU'),
            LMTD: getDefaultConfig('LMTD')
        };

        // Exchanger Configuration State (cloned to prevent reference sharing)
        const config = ref(JSON.parse(JSON.stringify(savedMethodConfigs.NTU)));

        const toggleConfigPanel = () => {
            showConfigPanel.value = !showConfigPanel.value;
            if (showConfigPanel.value && window.innerWidth < 1200) {
                showResultsPanel.value = false;
            }
        };

        const toggleResultsPanel = () => {
            showResultsPanel.value = !showResultsPanel.value;
            if (showResultsPanel.value && window.innerWidth < 1200) {
                showConfigPanel.value = false;
            }
        };

        const convertConfigUnits = (c, toEng) => {
            const C = HeatExchangerEngine.CONV;

            // Shell diameter dropdown uses exact integer nominal inches in English and exact 4-decimal meters in SI
            c.shell.diameter = toEng ? Math.round(c.shell.diameter / 0.0254) : +(c.shell.diameter * 0.0254).toFixed(4);
            c.tube.length = toEng ? c.tube.length * C.m_to_ft : c.tube.length * C.ft_to_m;
            c.tube.outerDiameter = toEng ? c.tube.outerDiameter * C.m_to_in : c.tube.outerDiameter * C.in_to_m;

            c.customU = toEng ? c.customU * C.U_si_to_eng : c.customU * C.U_eng_to_si;
            if (c.tube.k_material) c.tube.k_material = toEng ? c.tube.k_material * C.k_si_to_eng : c.tube.k_material * C.k_eng_to_si;

            const translateFluid = (f) => {
                f.tempIn = toEng ? HeatExchangerEngine.C_to_F(f.tempIn) : HeatExchangerEngine.F_to_C(f.tempIn);
                if (f.tempOut !== undefined) f.tempOut = toEng ? HeatExchangerEngine.C_to_F(f.tempOut) : HeatExchangerEngine.F_to_C(f.tempOut);
                f.massFlow = toEng ? f.massFlow * C.massflow_si_to_eng : f.massFlow * C.massflow_eng_to_si;
                f.cp = toEng ? f.cp * C.cp_si_to_eng : f.cp * C.cp_eng_to_si;
            };

            translateFluid(c.hotFluid);
            translateFluid(c.coldFluid);
        };

        const setUnitSystem = (newSys) => {
            if (unitSystem.value === newSys) return;
            unitSystem.value = newSys;

            const toEng = newSys === 'English';

            // Convert current active config
            convertConfigUnits(config.value, toEng);
            // Save a deep clone to the current method's cache
            savedMethodConfigs[calculationMethod.value] = JSON.parse(JSON.stringify(config.value));

            // Convert the other inactive method's cache once
            const otherMethod = calculationMethod.value === 'NTU' ? 'LMTD' : 'NTU';
            if (savedMethodConfigs[otherMethod]) {
                convertConfigUnits(savedMethodConfigs[otherMethod], toEng);
            }

            runSimulation();
        };

        const toggleCalculationMethod = () => {
            const previousMethod = calculationMethod.value;
            const nextMethod = previousMethod === 'NTU' ? 'LMTD' : 'NTU';
            savedMethodConfigs[previousMethod] = JSON.parse(JSON.stringify(config.value));
            let nextConfig = savedMethodConfigs[nextMethod];
            if (!nextConfig) {
                nextConfig = getDefaultConfig(nextMethod);
                if (unitSystem.value === 'English') {
                    convertConfigUnits(nextConfig, true);
                }
                savedMethodConfigs[nextMethod] = JSON.parse(JSON.stringify(nextConfig));
            }
            config.value = JSON.parse(JSON.stringify(nextConfig));
            calculationMethod.value = nextMethod;
            runSimulation();
        };

        const resetToDefaults = () => {
            const currentUnit = unitSystem.value;
            unitSystem.value = 'SI';
            savedMethodConfigs = {
                NTU: getDefaultConfig('NTU'),
                LMTD: getDefaultConfig('LMTD')
            };
            config.value = JSON.parse(JSON.stringify(savedMethodConfigs[calculationMethod.value]));
            if (currentUnit === 'English') {
                setUnitSystem('English');
            } else {
                runSimulation();
            }
        };

        const togglePanel = (nodeId) => {
            openPanels.value[nodeId] = !openPanels.value[nodeId];
        };

        const hxTypePassMap = {
            '1-1': { shellPasses: 1, tubePasses: 1 },
            '1-2': { shellPasses: 1, tubePasses: 2 },
            '1-4': { shellPasses: 1, tubePasses: 4 },
            '2-4': { shellPasses: 2, tubePasses: 4 }
        };

        const handleHxTypeChange = () => {
            const mapping = hxTypePassMap[config.value.hxType];
            if (mapping) {
                config.value.shell.passes = mapping.shellPasses;
                config.value.tube.passes = mapping.tubePasses;
            }
            runSimulation();
        };

        const materialDbKeys = Object.keys(MaterialDatabase);

        const handleMaterialChange = () => {
            const db = MaterialDatabase[config.value.tube.material];
            if (db) {
                let k = db.k;
                if (unitSystem.value === 'English') k *= HeatExchangerEngine.CONV.k_si_to_eng;
                config.value.tube.k_material = k;
                checkAndRunSimulation();
            }
        };

        const getMaterialKText = (materialName) => {
            const mat = MaterialDatabase[materialName];
            if (!mat) return '';
            if (unitSystem.value === 'SI') return `${mat.k} W/mK`;
            return `${(mat.k * HeatExchangerEngine.CONV.k_si_to_eng).toFixed(1)} BTU/(hr·ft·°F)`;
        };

        let engine = null;
        let renderer = null;
        let tempChartInstance = null;

        onMounted(() => {
            engine = new HeatExchangerEngine();
            renderer = new Renderer('hxCanvas');
            // Initial render
            runSimulation();
        });

        const simulationResults = ref(null);
        const calculationError = ref('');

        const toggleGraphs = () => {
            showGraphs.value = !showGraphs.value;
            if (showGraphs.value) {
                nextTick(() => {
                    updateCharts(simulationResults.value);
                });
            }
        };

        const toggleAbout = () => {
            showAbout.value = !showAbout.value;
            if (showAbout.value) {
                nextTick(() => {
                    if (window.MathJax) {
                        window.MathJax.typesetPromise();
                    }
                });
            }
        };

        const runSimulation = () => {
            if (!engine || !renderer) return;
            const calculationConfig = JSON.parse(JSON.stringify(config.value));
            calculationConfig.calculationMethod = calculationMethod.value;
            const result = engine.calculate(calculationConfig, unitSystem.value);
            if (!result.valid) {
                simulationResults.value = null;
                calculationError.value = result.error;
                renderer.stop();
                return;
            }

            calculationError.value = '';
            simulationResults.value = result;

            // Clone config and transform to SI for renderer to avoid changing drawing logic
            const renderConfig = JSON.parse(JSON.stringify(config.value));
            if (unitSystem.value === 'English') {
                const C = HeatExchangerEngine.CONV;
                renderConfig.shell.diameter *= C.in_to_m;
                renderConfig.tube.length *= C.ft_to_m;
                renderConfig.tube.outerDiameter *= C.in_to_m;
                renderConfig.hotFluid.tempIn = HeatExchangerEngine.F_to_C(renderConfig.hotFluid.tempIn);
                renderConfig.coldFluid.tempIn = HeatExchangerEngine.F_to_C(renderConfig.coldFluid.tempIn);
                if (renderConfig.hotFluid.tempOut !== undefined) {
                    renderConfig.hotFluid.tempOut = HeatExchangerEngine.F_to_C(renderConfig.hotFluid.tempOut);
                }
                if (renderConfig.coldFluid.tempOut !== undefined) {
                    renderConfig.coldFluid.tempOut = HeatExchangerEngine.F_to_C(renderConfig.coldFluid.tempOut);
                }
                renderConfig.hotFluid.massFlow *= C.massflow_eng_to_si;
                renderConfig.coldFluid.massFlow *= C.massflow_eng_to_si;
            }
            // For the renderer, temperatures should remain in SI so colors map correctly
            // Wait, the results object passed to renderer has tempOuts and profile in English!
            // We should clone and invert those too for the renderer
            const renderResult = JSON.parse(JSON.stringify(result));
            if (unitSystem.value === 'English') {
                renderResult.hotTempOut = HeatExchangerEngine.F_to_C(renderResult.hotTempOut);
                renderResult.coldTempOut = HeatExchangerEngine.F_to_C(renderResult.coldTempOut);
                renderResult.profile.forEach(p => {
                    p.Th = HeatExchangerEngine.F_to_C(p.Th);
                    p.Tc = HeatExchangerEngine.F_to_C(p.Tc);
                    p.tubePasses = p.tubePasses.map(t => HeatExchangerEngine.F_to_C(t));
                });
            }

            renderer.start(renderConfig, renderResult);

            // Only update charts if Chart.js is loaded
            if (typeof Chart !== 'undefined') {
                updateCharts(result);
            }
        };

        const updateCharts = (result) => {
            if (!result || !result.profile) return;

            // 1. Temperature Profile Chart
            const ctxTemp = document.getElementById('tempChart');
            if (ctxTemp) {
                const labels = result.profile.map(p => p.x.toFixed(2));
                const hotData = result.profile.map(p => p.Th);

                const tUnit = unitSystem.value === 'SI' ? '°C' : '°F';

                if (tempChartInstance) tempChartInstance.destroy();

                const numPoints = result.profile.length;
                const midIdx = Math.floor(numPoints / 2);

                const getPointProps = (dir, color) => {
                    return {
                        pointRadius: result.profile.map((_, i) => i === midIdx ? 7 : 0),
                        pointHoverRadius: result.profile.map((_, i) => i === midIdx ? 9 : 4),
                        pointStyle: result.profile.map((_, i) => i === midIdx ? 'triangle' : 'circle'),
                        pointRotation: result.profile.map((_, i) => i === midIdx ? (dir === 'right' ? 90 : -90) : 0),
                        pointBackgroundColor: color
                    };
                };

                const datasets = [
                    {
                        label: `Hot Fluid Temp (${tUnit})`,
                        data: hotData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: false,
                        ...getPointProps('right', '#ef4444')
                    }
                ];

                if (config.value.tube.passes > 1) {
                    for (let pass = 0; pass < config.value.tube.passes; pass++) {
                        const passData = result.profile.map(p => p.tubePasses[pass]);
                        const isEven = pass % 2 === 0;
                        const direction = isEven ? 'right' : 'left';
                        const color = isEven ? '#3b82f6' : '#0ea5e9';
                        datasets.push({
                            label: `Cold Fluid (Pass ${pass + 1}) (${tUnit})`,
                            data: passData,
                            borderColor: color,
                            backgroundColor: isEven ? 'rgba(59, 130, 246, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                            tension: 0.4,
                            fill: false,
                            ...getPointProps(direction, color)
                        });
                    }
                } else {
                    const coldData = result.profile.map(p => p.Tc);
                    const direction = config.value.tube.flowArrangement === 'parallel' ? 'right' : 'left';
                    datasets.push({
                        label: `Cold Fluid Temp (${tUnit})`,
                        data: coldData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: false,
                        ...getPointProps(direction, '#3b82f6')
                    });
                }

                tempChartInstance = new Chart(ctxTemp, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { font: { size: 11 } } },
                            tooltip: { mode: 'index', intersect: false }
                        },
                        scales: {
                            x: { title: { display: true, text: 'Fractional Length (x/L)', font: { size: 11 } } },
                            y: {
                                title: { display: true, text: `Temperature (${tUnit})`, font: { size: 11 } },
                                ticks: { stepSize: unitSystem.value === 'SI' ? 20 : 40 }
                            }
                        }
                    }
                });
            }
        };

        const checkAndRunSimulation = () => {
            if (config.value.shell.passes === 2 && config.value.tube.passes === 1) {
                config.value.tube.passes = 2; // Auto-correct invalid geometry
            }
            runSimulation();
        };

        const exportConfigAsJSON = () => {
            const exportData = {
                config: config.value,
                results: simulationResults.value
            };
            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", "hx_config_export.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            document.body.removeChild(downloadAnchorNode);
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        };

        return {
            config,
            openPanels,
            togglePanel,
            runSimulation,
            checkAndRunSimulation,
            exportConfigAsJSON,
            materialDbKeys,
            MaterialDatabase,
            handleMaterialChange,
            handleHxTypeChange,
            simulationResults,
            calculationError,
            showGraphs,
            toggleGraphs,
            showAbout,
            toggleAbout,
            showConfigPanel,
            toggleConfigPanel,
            showResultsPanel,
            toggleResultsPanel,
            unitSystem,
            calculationMethod,
            toggleCalculationMethod,
            setUnitSystem,
            resetToDefaults,
            getMaterialKText,
            aboutPdfUrl: new URL('HX_About_page 1.4.pdf', import.meta.url).href
        };
    },
    template: `
        <div class="toolbar">
            <button class="mobile-toggle-btn" @click="toggleConfigPanel" style="padding: 8px 12px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                Config
            </button>
            <h1 class="toolbar-title">S&T Heat Exchanger Design Suite</h1>
            <div style="display: flex; gap: 8px; align-items: center;">
                <div class="unit-toggle" style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 6px;">
                    <button @click="setUnitSystem('SI')" :style="{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: unitSystem === 'SI' ? 'white' : 'transparent', color: unitSystem === 'SI' ? '#0f172a' : '#64748b', boxShadow: unitSystem === 'SI' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }">
                        Metric (SI)
                    </button>
                    <button @click="setUnitSystem('English')" :style="{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: unitSystem === 'English' ? 'white' : 'transparent', color: unitSystem === 'English' ? '#0f172a' : '#64748b', boxShadow: unitSystem === 'English' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }">
                        (Imperial)
                    </button>
                </div>
                <button @click="toggleCalculationMethod" style="padding: 8px 12px; background: #0f766e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
                    Method: {{ calculationMethod }}
                </button>
                <div v-if="calculationMethod === 'LMTD'" class="unit-toggle" style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 6px;">
                    <button @click="config.lmtdKnownFluid = 'hot'; runSimulation()" :style="{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: config.lmtdKnownFluid === 'hot' ? 'white' : 'transparent', color: config.lmtdKnownFluid === 'hot' ? '#0f172a' : '#64748b', boxShadow: config.lmtdKnownFluid === 'hot' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }">
                        Shell Defines Outlet
                    </button>
                    <button @click="config.lmtdKnownFluid = 'cold'; runSimulation()" :style="{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: config.lmtdKnownFluid === 'cold' ? 'white' : 'transparent', color: config.lmtdKnownFluid === 'cold' ? '#0f172a' : '#64748b', boxShadow: config.lmtdKnownFluid === 'cold' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }">
                        Tube Defines Outlet
                    </button>
                </div>
                <button class="mobile-toggle-btn" @click="toggleResultsPanel" style="padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    Results
                </button>
            </div>
        </div>
        <div class="designer-layout">
            <!-- Left Sidebar: Properties Accordion -->
            <div class="sidebar properties-sidebar" :class="{ 'panel-open': showConfigPanel }">
                <div class="sidebar-header">Configuration</div>
                <div class="sidebar-content" style="padding: 0;">
                    
                    <!-- Shell Settings -->
                    <div class="accordion-section" v-if="calculationMethod === 'NTU'">
                        <div class="accordion-header" :class="{ active: openPanels.shell }" @click="togglePanel('shell')">
                            <span>Shell Settings</span>
                            <span class="chevron">{{ openPanels.shell ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.shell">
                            <div class="input-group">
                                <label>Shell Passes</label>
                                <select v-model.number="config.shell.passes" @change="checkAndRunSimulation">
                                    <option :value="1">1 Pass</option>
                                    <option :value="2">2 Passes</option>
                                </select>
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'NTU'">
                                <label>Shell Diameter (Nominal ID)</label>
                                <select v-model.number="config.shell.diameter" @change="runSimulation">
                                    <optgroup label="Light Industrial / Utility">
                                        <option :value="unitSystem === 'SI' ? 0.1016 : 4">4" {{ unitSystem === 'SI' ? '(0.10m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.1524 : 6">6" {{ unitSystem === 'SI' ? '(0.15m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.2032 : 8">8" {{ unitSystem === 'SI' ? '(0.20m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.2540 : 10">10" {{ unitSystem === 'SI' ? '(0.25m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.3048 : 12">12" {{ unitSystem === 'SI' ? '(0.30m)' : '' }}</option>
                                    </optgroup>
                                    <optgroup label="Standard Plant Processing (Pipe Shells)">
                                        <option :value="unitSystem === 'SI' ? 0.3556 : 14">14" {{ unitSystem === 'SI' ? '(0.36m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.4064 : 16">16" {{ unitSystem === 'SI' ? '(0.41m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.4572 : 18">18" {{ unitSystem === 'SI' ? '(0.46m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.5080 : 20">20" {{ unitSystem === 'SI' ? '(0.51m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.6096 : 24">24" {{ unitSystem === 'SI' ? '(0.61m)' : '' }}</option>
                                    </optgroup>
                                    <optgroup label="Heavy Petrochemical (Rolled Plate)">
                                        <option :value="unitSystem === 'SI' ? 0.7620 : 30">30" {{ unitSystem === 'SI' ? '(0.76m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 0.9144 : 36">36" {{ unitSystem === 'SI' ? '(0.91m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 1.0668 : 42">42" {{ unitSystem === 'SI' ? '(1.07m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 1.2192 : 48">48" {{ unitSystem === 'SI' ? '(1.22m)' : '' }}</option>
                                        <option :value="unitSystem === 'SI' ? 1.5240 : 60">60" {{ unitSystem === 'SI' ? '(1.52m)' : '' }}</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Overall Heat Transfer Coefficient, U ({{ unitSystem === 'SI' ? 'W/m²K' : 'BTU/(hr·ft²·°F)' }})</label>
                                <input type="number" v-model.number="config.customU" step="10" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Tube Bundle -->
                    <div class="accordion-section" v-if="calculationMethod === 'NTU'">
                        <div class="accordion-header" :class="{ active: openPanels.tube }" @click="togglePanel('tube')">
                            <span>Tube Bundle</span>
                            <span class="chevron">{{ openPanels.tube ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.tube">
                            <div class="input-group" v-if="config.shell.passes === 1 && config.tube.passes === 1">
                                <label>Flow Arrangement</label>
                                <select v-model="config.tube.flowArrangement" @change="runSimulation">
                                    <option value="counter">Counter Flow</option>
                                    <option value="parallel">Parallel Flow</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Tube Material</label>
                                <select v-model="config.tube.material" @change="handleMaterialChange">
                                    <option v-for="key in materialDbKeys" :key="key" :value="key">{{ key }}</option>
                                </select>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">
                                    {{ MaterialDatabase[config.tube.material]?.description }} (k = {{ getMaterialKText(config.tube.material) }})
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Tube Passes</label>
                                <select v-model.number="config.tube.passes" @change="checkAndRunSimulation">
                                    <option :value="1" v-if="config.shell.passes === 1">1 Pass</option>
                                    <option :value="2">2 Passes</option>
                                    <option :value="4">4 Passes</option>
                                    <option :value="6">6 Passes</option>
                                    <option :value="8">8 Passes</option>
                                    <option :value="12">12 Passes</option>
                                </select>
                            </div>
                            <div class="input-group">
                                <label>Tubes per Pass</label>
                                <input type="number" v-model.number="config.tube.tubesPerPass" min="1" max="1000" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'NTU'">
                                <label>Tube Length ({{ unitSystem === 'SI' ? 'm' : 'ft' }})</label>
                                <input type="number" v-model.number="config.tube.length" step="0.1" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'NTU'">
                                <label>Outer Diameter ({{ unitSystem === 'SI' ? 'm' : 'in' }})</label>
                                <input type="number" v-model.number="config.tube.outerDiameter" step="0.001" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Heat Exchanger Settings (LMTD only) -->
                    <div class="accordion-section" v-if="calculationMethod === 'LMTD'">
                        <div class="accordion-header" :class="{ active: openPanels.hxSettings }" @click="togglePanel('hxSettings')">
                            <span>Heat Exchanger Settings</span>
                            <span class="chevron">{{ openPanels.hxSettings ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.hxSettings">
                            <div class="input-group">
                                <label>Overall Heat Transfer Coefficient, U ({{ unitSystem === 'SI' ? 'W/m²K' : 'BTU/(hr·ft²·°F)' }})</label>
                                <input type="number" v-model.number="config.customU" step="10" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Heat Exchanger Type</label>
                                <select v-model="config.hxType" @change="handleHxTypeChange">
                                    <option value="1-1">1 Shell Pass - 1 Tube Pass</option>
                                    <option value="1-2">1 Shell Pass - 2 Tube Passes</option>
                                    <option value="1-4">1 Shell Pass - 4 Tube Passes</option>
                                    <option value="2-4">2 Shell Passes - 4 Tube Passes</option>
                                    <option value="other">Other Type</option>
                                </select>
                            </div>
                            <div class="input-group" v-if="config.hxType === '1-1'">
                                <label>Flow Arrangement</label>
                                <select v-model="config.tube.flowArrangement" @change="runSimulation">
                                    <option value="counter">Counter Flow</option>
                                    <option value="parallel">Parallel Flow</option>
                                </select>
                            </div>
                            <div class="input-group" v-if="config.hxType === 'other'">
                                <label>F-Factor (manual entry)</label>
                                <input type="number" v-model.number="config.manualFFactor" step="0.01" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Hot Fluid Settings -->
                    <div class="accordion-section">
                        <div class="accordion-header" :class="{ active: openPanels.hotFluid }" @click="togglePanel('hotFluid')">
                            <span>Shell Fluid</span>
                            <span class="chevron">{{ openPanels.hotFluid ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.hotFluid">
                            <div class="input-group">
                                <label>Inlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.hotFluid.tempIn" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'LMTD' && config.lmtdKnownFluid === 'hot'">
                                <label>Outlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.hotFluid.tempOut" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'LMTD' && config.lmtdKnownFluid === 'cold'">
                                <label>Outlet Temperature (calculated)</label>
                                <input type="text" :value="simulationResults ? simulationResults.hotTempOut.toFixed(1) : '--'" disabled style="background: #f1f5f9; color: #64748b;">
                            </div>
                            <div class="input-group">
                                <label>Mass Flow ({{ unitSystem === 'SI' ? 'kg/s' : 'lb/hr' }})</label>
                                <input type="number" v-model.number="config.hotFluid.massFlow" step="0.1" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Specific Heat, Cp ({{ unitSystem === 'SI' ? 'kJ/kg·K' : 'BTU/(lb·°F)' }})</label>
                                <input type="number" v-model.number="config.hotFluid.cp" step="0.01" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Cold Fluid Settings -->
                    <div class="accordion-section">
                        <div class="accordion-header" :class="{ active: openPanels.coldFluid }" @click="togglePanel('coldFluid')">
                            <span>Tube Fluid</span>
                            <span class="chevron">{{ openPanels.coldFluid ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.coldFluid">
                            <div class="input-group">
                                <label>Inlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.coldFluid.tempIn" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'LMTD' && config.lmtdKnownFluid === 'cold'">
                                <label>Outlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.coldFluid.tempOut" @input="runSimulation">
                            </div>
                            <div class="input-group" v-if="calculationMethod === 'LMTD' && config.lmtdKnownFluid === 'hot'">
                                <label>Outlet Temperature (calculated)</label>
                                <input type="text" :value="simulationResults ? simulationResults.coldTempOut.toFixed(1) : '--'" disabled style="background: #f1f5f9; color: #64748b;">
                            </div>
                            <div class="input-group">
                                <label>Mass Flow ({{ unitSystem === 'SI' ? 'kg/s' : 'lb/hr' }})</label>
                                <input type="number" v-model.number="config.coldFluid.massFlow" step="0.1" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Specific Heat, Cp ({{ unitSystem === 'SI' ? 'kJ/kg·K' : 'BTU/(lb·°F)' }})</label>
                                <input type="number" v-model.number="config.coldFluid.cp" step="0.01" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Reset Button -->
                    <div style="padding: 15px; margin-top: auto; border-top: 1px solid #e2e8f0;">
                        <button @click="resetToDefaults" style="width: 100%; padding: 10px; background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#cbd5e1'" onmouseout="this.style.background='#e2e8f0'">
                            Reset to Defaults
                        </button>
                    </div>

                </div>
            </div>

            <!-- Main Canvas Area -->
            <div class="main-area" style="flex-direction: column; position: relative; overflow: hidden;">
                <div v-if="calculationMethod === 'LMTD' && config.hxType === 'other'" style="padding: 10px 16px; background: #fef3c7; color: #92400e; border-bottom: 1px solid #fbbf24; font-weight: 600; font-size: 13px; text-align: center;">
                    Inaccurate HX Arrangement
                </div>
                <div style="flex: 1; position: relative; width: 100%;">
                    <canvas id="hxCanvas" style="width: 100%; height: 100%; display: block; position: absolute;"></canvas>
                    <div v-if="calculationError" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(90%, 420px); padding: 16px; color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; text-align: center; font-weight: 600; z-index: 5;">
                        Calculation stopped: {{ calculationError }}
                    </div>
                    
                    <!-- Temperature Legend Overlay -->
                    <div v-if="simulationResults" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.9); padding: 10px 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: bold; color: #1e293b; z-index: 10; pointer-events: none;">
                        <div style="text-align: center; margin-bottom: 2px;">Temperature Mapping</div>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <span>{{ Math.min(config.coldFluid.tempIn, simulationResults.coldTempOut).toFixed(0) }}{{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                            <div style="width: 120px; height: 12px; background: linear-gradient(to right, rgb(59, 130, 246), rgb(239, 68, 68)); border-radius: 3px;"></div>
                            <span>{{ Math.max(config.hotFluid.tempIn, simulationResults.hotTempOut).toFixed(0) }}{{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                        </div>
                    </div>
                </div>

                <!-- Slide-up Graph Drawer -->
                <div class="graphs-drawer" :style="{ transform: showGraphs ? 'translateY(0)' : 'translateY(calc(100% + 40px))' }">
                    <div style="padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px 12px 0 0;">
                        <h3 style="margin: 0; font-size: 15px; color: #1e293b;">Temperature Profile (T vs. x/L)</h3>
                        <button @click="toggleGraphs" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
                    </div>
                    <div style="flex: 1; padding: 15px 15px 25px 15px; position: relative; min-height: 0;">
                        <canvas id="tempChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Right Sidebar: Results Dashboard -->
            <div class="properties-panel results-sidebar" :class="{ 'panel-open': showResultsPanel }" style="background: var(--bg-color);">
                <div class="sidebar-header" style="background: var(--panel-bg);">Design Results</div>
                <div class="sidebar-content" style="padding: 15px; display: flex; flex-direction: column; gap: 15px;" v-if="simulationResults">
                    
                    <!-- Design Results List (Ungrouped) -->
                    <div class="dashboard-card" style="position: static; flex: none; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div class="card-body" style="display: flex; flex-direction: column; gap: 10px;">
                            <div class="data-row" v-if="calculationMethod === 'NTU'">
                                <span class="data-label">Rate of Heat Transfer:</span>
                                <span class="data-value">{{ simulationResults.Q.toFixed(1) }} {{ unitSystem === 'SI' ? 'kW' : 'BTU/hr' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'NTU'">
                                <span class="data-label">Th,out:</span>
                                <span class="data-value">{{ simulationResults.hotTempOut.toFixed(1) }} {{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'NTU'">
                                <span class="data-label">Tc,out:</span>
                                <span class="data-value">{{ simulationResults.coldTempOut.toFixed(1) }} {{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'NTU'">
                                <span class="data-label">Effectiveness (ε):</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>{{ simulationResults.epsilon.toFixed(2) }}</span>
                                </span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">Rate of Heat Transfer:</span>
                                <span class="data-value">{{ simulationResults.Q.toFixed(1) }} {{ unitSystem === 'SI' ? 'kW' : 'BTU/hr' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">&Delta;T<sub>lm</sub>:</span>
                                <span class="data-value">{{ simulationResults.LMTD.toFixed(2) }} {{ unitSystem === 'SI' ? 'K' : '°F' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">P:</span>
                                <span class="data-value">{{ simulationResults.P.toFixed(3) }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">R:</span>
                                <span class="data-value">{{ simulationResults.R.toFixed(3) }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">Correction Factor:</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>
                                        {{ simulationResults.F_factor.toFixed(3) }} 
                                        <span v-if="simulationResults.F_factor >= 0.75" class="status-ok">[OK]</span>
                                    </span>
                                </span>
                            </div>
                            
                            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;" />
                            
                            <div class="data-row" v-if="calculationMethod === 'NTU'">
                                <span class="data-label">Total Area:</span>
                                <span class="data-value">{{ simulationResults.A.toFixed(1) }} {{ unitSystem === 'SI' ? 'm²' : 'ft²' }}</span>
                            </div>
                            <div class="data-row" v-if="calculationMethod === 'LMTD'">
                                <span class="data-label">Req. Area:</span>
                                <span class="data-value">{{ simulationResults.A_req.toFixed(1) }} {{ unitSystem === 'SI' ? 'm²' : 'ft²' }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: auto; display: flex; flex-direction: column;">
                        <button v-if="config.shell.passes === 1 && config.tube.passes === 1" 
                                @click="toggleGraphs" 
                                style="padding: 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 10px;">
                            View Temperature Profile Graph
                        </button>
                        <button @click="toggleAbout" style="padding: 10px; background: #0f172a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 10px;">
                            About This Model
                        </button>
                        <button @click="exportConfigAsJSON" style="padding: 10px; background: #334155; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            Export Settings (JSON)
                        </button>
                    </div>
                </div>
            </div>

            <!-- About Modal Overlay -->
            <div v-if="showAbout" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; width: 90%; max-width: 1000px; height: 85vh; display: flex; flex-direction: column; position: relative; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                    <button @click="toggleAbout" style="position: absolute; top: 15px; right: 20px; background: none; border: none; font-size: 28px; cursor: pointer; color: #64748b; line-height: 1; z-index: 1010;">&times;</button>
                    <div style="flex: 1; margin-top: 30px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; background: #ffffff;">
                        <iframe :src="aboutPdfUrl" style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                </div>
            </div>
            </div>

            <div style="position: fixed; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 11px; color: #94a3b8; opacity: 0.6; pointer-events: none; z-index: 5;">
                Preliminary Model. For Concept Only.
            </div>

            <!-- Graphs removed from modal overlay and embedded into drawer -->
        </div>
    `
};

createApp(App).mount('#app');
