import { createApp, ref, onMounted, watch, nextTick } from 'vue';
import { HeatExchangerEngine } from './engine.js';
import { Renderer } from './render.js';
import { FluidDatabase, MaterialDatabase, FoulingDatabase } from './database.js';

const App = {
    setup() {
        const openPanels = ref({
            shell: false,
            tube: false,
            hotFluid: false,
            coldFluid: false
        });

        const showGraphs = ref(false);
        const showAbout = ref(false);
        const showConfigPanel = ref(window.innerWidth >= 1200);
        const showResultsPanel = ref(window.innerWidth >= 1200);
        const unitSystem = ref('SI');

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

        const setUnitSystem = (newSys) => {
            if (unitSystem.value === newSys) return;
            unitSystem.value = newSys;

            const c = config.value;
            const C = HeatExchangerEngine.CONV;
            const toEng = newSys === 'English';

            c.shell.diameter = toEng ? c.shell.diameter * C.m_to_in : c.shell.diameter * C.in_to_m;
            c.tube.length = toEng ? c.tube.length * C.m_to_ft : c.tube.length * C.ft_to_m;
            c.tube.outerDiameter = toEng ? c.tube.outerDiameter * C.m_to_in : c.tube.outerDiameter * C.in_to_m;

            if (c.customU) c.customU = toEng ? c.customU * C.U_si_to_eng : c.customU * C.U_eng_to_si;
            if (c.tube.k_material) c.tube.k_material = toEng ? c.tube.k_material / C.k_eng_to_si : c.tube.k_material * C.k_eng_to_si;

            const translateFluid = (f) => {
                f.tempIn = toEng ? HeatExchangerEngine.C_to_F(f.tempIn) : HeatExchangerEngine.F_to_C(f.tempIn);
                f.massFlow = toEng ? f.massFlow * C.massflow_si_to_eng : f.massFlow * C.massflow_eng_to_si;
                f.cp = toEng ? f.cp / C.cp_eng_to_si : f.cp * C.cp_eng_to_si;
                if (f.rho) f.rho = toEng ? f.rho / C.rho_eng_to_si : f.rho * C.rho_eng_to_si;
                if (f.mu) f.mu = toEng ? f.mu / C.mu_eng_to_si : f.mu * C.mu_eng_to_si;
                if (f.k) f.k = toEng ? f.k / C.k_eng_to_si : f.k * C.k_eng_to_si;
                if (f.Rf) f.Rf = toEng ? f.Rf / C.U_si_to_eng : f.Rf * C.U_si_to_eng;
            };

            translateFluid(c.hotFluid);
            translateFluid(c.coldFluid);

            runSimulation();
        };

        const getDefaultConfig = () => ({
            useCustomU: false,
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
                name: 'Engine Oil (Light Mineral Oil)',
                tempIn: 120,
                massFlow: 1.8,
                cp: 1.95,
                rho: 880,
                mu: 0.05,
                k: 0.14,
                Rf: 0,
                warning: ''
            },
            coldFluid: {
                name: 'Water',
                tempIn: 20,
                massFlow: 2.5,
                cp: 4.181,
                rho: 998,
                mu: 0.001,
                k: 0.6,
                fouling: 'Cooling Tower Water',
                Rf: 0.0003,
                warning: ''
            }
        });

        // Exchanger Configuration State
        const config = ref(getDefaultConfig());

        const resetToDefaults = () => {
            const currentUnit = unitSystem.value;
            unitSystem.value = 'SI';
            config.value = getDefaultConfig();
            if (currentUnit === 'English') {
                setUnitSystem('English');
            } else {
                runSimulation();
            }
        };

        const togglePanel = (nodeId) => {
            openPanels.value[nodeId] = !openPanels.value[nodeId];
        };

        const fluidDbKeys = Object.keys(FluidDatabase);
        const materialDbKeys = Object.keys(MaterialDatabase);
        const foulingDbKeys = Object.keys(FoulingDatabase);

        const handleFluidChange = (fluidState) => {
            const db = FluidDatabase[fluidState.name];
            if (db) {
                fluidState.cp = db.cp;
                fluidState.rho = db.rho;
                fluidState.mu = db.mu;
                fluidState.k = db.k;

                if (unitSystem.value === 'English') {
                    const C = HeatExchangerEngine.CONV;
                    fluidState.cp /= C.cp_eng_to_si;
                    fluidState.rho /= C.rho_eng_to_si;
                    fluidState.mu /= C.mu_eng_to_si;
                    fluidState.k /= C.k_eng_to_si;
                }

                checkFluidTemp(fluidState);
            }
        };

        const handleMaterialChange = () => {
            const db = MaterialDatabase[config.value.tube.material];
            if (db) {
                let k = db.k;
                if (unitSystem.value === 'English') k /= HeatExchangerEngine.CONV.k_eng_to_si;
                config.value.tube.k_material = k;
                checkAndRunSimulation();
            }
        };

        const handleFoulingChange = (fluidState) => {
            const db = FoulingDatabase[fluidState.fouling];
            if (db) {
                let Rf = db.Rf;
                if (unitSystem.value === 'English') Rf /= HeatExchangerEngine.CONV.U_si_to_eng;
                fluidState.Rf = Rf;
                checkAndRunSimulation();
            }
        };

        const checkFluidTemp = (fluidState) => {
            const db = FluidDatabase[fluidState.name];
            if (!db) return;

            fluidState.warning = '';
            fluidState.description = db.description;

            let maxT = db.maxT;
            let minT = db.minT;
            if (unitSystem.value === 'English') {
                maxT = HeatExchangerEngine.C_to_F(maxT);
                minT = HeatExchangerEngine.C_to_F(minT);
            }

            if (fluidState.tempIn > maxT) {
                fluidState.warning = `Fluid exceeds boiling point (${maxT.toFixed(1)}°). Switch to a phase-change model or lower the temperature.`;
            } else if (fluidState.tempIn < minT) {
                fluidState.warning = `Fluid drops below freezing point (${minT.toFixed(1)}°). Switch to a phase-change model or raise the temperature.`;
            }

            // Manually trigger simulation after check
            runSimulation();
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
            const result = engine.calculate(config.value, unitSystem.value);
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

        const getOverdesignColor = (val) => {
            if (Math.abs(val) < 0.05) {
                return '#64748b'; // Gray/slate
            } else if (val > 0 && val <= 30) {
                return '#10b981'; // Green
            } else if (val >= 40 && val <= 50) {
                return '#f97316'; // Orange
            } else {
                return '#ef4444'; // Red
            }
        };

        return {
            config,
            getOverdesignColor,
            openPanels,
            togglePanel,
            runSimulation,
            checkAndRunSimulation,
            exportConfigAsJSON,
            fluidDbKeys,
            materialDbKeys,
            foulingDbKeys,
            FluidDatabase,
            MaterialDatabase,
            FoulingDatabase,
            handleFluidChange,
            handleMaterialChange,
            handleFoulingChange,
            checkFluidTemp,
            simulationResults,
            showGraphs,
            toggleGraphs,
            showAbout,
            toggleAbout,
            showConfigPanel,
            toggleConfigPanel,
            showResultsPanel,
            toggleResultsPanel,
            unitSystem,
            setUnitSystem,
            resetToDefaults
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
                        English (Imperial)
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
                    <div class="accordion-section">
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
                            <div class="input-group">
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
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" v-model="config.useCustomU" @change="runSimulation" style="width: auto;">
                                    Override Overall Heat Transfer Coefficient (U)
                                </label>
                            </div>
                            <div class="input-group" v-if="config.useCustomU">
                                <label>Custom U Value ({{ unitSystem === 'SI' ? 'W/m²K' : 'BTU/(hr·ft²·°F)' }})</label>
                                <input type="number" v-model.number="config.customU" step="10" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Tube Bundle -->
                    <div class="accordion-section">
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
                                    {{ MaterialDatabase[config.tube.material]?.description }} (k = {{ MaterialDatabase[config.tube.material]?.k }} W/mK)
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
                            <div class="input-group">
                                <label>Tube Length ({{ unitSystem === 'SI' ? 'm' : 'ft' }})</label>
                                <input type="number" v-model.number="config.tube.length" step="0.1" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Outer Diameter ({{ unitSystem === 'SI' ? 'm' : 'in' }})</label>
                                <input type="number" v-model.number="config.tube.outerDiameter" step="0.001" @input="runSimulation">
                            </div>
                        </div>
                    </div>

                    <!-- Hot Fluid Settings -->
                    <div class="accordion-section">
                        <div class="accordion-header" :class="{ active: openPanels.hotFluid }" @click="togglePanel('hotFluid')">
                            <span>Hot Fluid (Shell)</span>
                            <span class="chevron">{{ openPanels.hotFluid ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.hotFluid">
                            <div class="input-group">
                                <label>Fluid Type</label>
                                <select v-model="config.hotFluid.name" @change="handleFluidChange(config.hotFluid)">
                                    <option v-for="key in fluidDbKeys" :key="key" :value="key">{{ key }}</option>
                                </select>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">
                                    {{ FluidDatabase[config.hotFluid.name]?.description }}
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Inlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.hotFluid.tempIn" @change="checkFluidTemp(config.hotFluid)">
                                <div v-if="config.hotFluid.warning" style="color: #ef4444; font-size: 11px; margin-top: 6px; padding: 6px; background: #fee2e2; border-radius: 4px; border: 1px solid #fca5a5;">
                                    <strong>Warning:</strong> {{ config.hotFluid.warning }}
                                </div>
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
                            <span>Cold Fluid (Tube)</span>
                            <span class="chevron">{{ openPanels.coldFluid ? '▼' : '▶' }}</span>
                        </div>
                        <div class="accordion-body" v-if="openPanels.coldFluid">
                            <div class="input-group">
                                <label>Fluid Type</label>
                                <select v-model="config.coldFluid.name" @change="handleFluidChange(config.coldFluid)">
                                    <option value="Water">Water</option>
                                </select>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">
                                    {{ FluidDatabase[config.coldFluid.name]?.description }}
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Inlet Temperature ({{ unitSystem === 'SI' ? '°C' : '°F' }})</label>
                                <input type="number" v-model.number="config.coldFluid.tempIn" @change="checkFluidTemp(config.coldFluid)">
                                <div v-if="config.coldFluid.warning" style="color: #ef4444; font-size: 11px; margin-top: 6px; padding: 6px; background: #fee2e2; border-radius: 4px; border: 1px solid #fca5a5;">
                                    <strong>Warning:</strong> {{ config.coldFluid.warning }}
                                </div>
                            </div>
                            <div class="input-group">
                                <label>Mass Flow ({{ unitSystem === 'SI' ? 'kg/s' : 'lb/hr' }})</label>
                                <input type="number" v-model.number="config.coldFluid.massFlow" step="0.1" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Specific Heat, Cp ({{ unitSystem === 'SI' ? 'kJ/kg·K' : 'BTU/(lb·°F)' }})</label>
                                <input type="number" v-model.number="config.coldFluid.cp" step="0.01" @input="runSimulation">
                            </div>
                            <div class="input-group">
                                <label>Fouling Margin (Tube Side)</label>
                                <select v-model="config.coldFluid.fouling" @change="handleFoulingChange(config.coldFluid)">
                                    <option v-for="key in foulingDbKeys" :key="key" :value="key">{{ key }}</option>
                                </select>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">
                                    {{ FoulingDatabase[config.coldFluid.fouling]?.description }}
                                </div>
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
                <div style="flex: 1; position: relative; width: 100%;">
                    <canvas id="hxCanvas" style="width: 100%; height: 100%; display: block; position: absolute;"></canvas>
                    
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
                            <div class="data-row">
                                <span class="data-label">Heat Duty:</span>
                                <span class="data-value">{{ simulationResults.Q.toFixed(1) }} {{ unitSystem === 'SI' ? 'kW' : 'BTU/hr' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Th,out:</span>
                                <span class="data-value">{{ simulationResults.hotTempOut.toFixed(1) }} {{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Tc,out:</span>
                                <span class="data-value">{{ simulationResults.coldTempOut.toFixed(1) }} {{ unitSystem === 'SI' ? '°C' : '°F' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Effectiveness (ε):</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>{{ simulationResults.epsilon.toFixed(2) }}</span>
                                </span>
                            </div>
                            <div v-if="simulationResults.NTU > 2.0" style="margin-top: 10px; margin-bottom: 12px; padding: 10px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; color: #b45309; border-radius: 4px; font-weight: 500; font-size: 13px;">
                                <strong>High NTU / Surface area optimized.</strong>
                            </div>
                            <div class="data-row">
                                <span class="data-label">LMTD F-Factor:</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>
                                        {{ simulationResults.F_factor.toFixed(2) }} 
                                        <span v-if="simulationResults.F_factor >= 0.75" class="status-ok">[OK]</span>
                                    </span>
                                    <span v-if="simulationResults.F_factor < 0.75" style="color: #ea580c; font-weight: bold; font-size: 10px; margin-top: 2px; text-align: right;">
                                        [WARNING: Temperature Cross / Low Efficiency]
                                    </span>
                                </span>
                            </div>
                            
                            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;" />
                            
                            <div class="data-row">
                                <span class="data-label">Total Area:</span>
                                <span class="data-value">{{ simulationResults.A.toFixed(1) }} {{ unitSystem === 'SI' ? 'm²' : 'ft²' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Req. Area:</span>
                                <span class="data-value">{{ simulationResults.A_req.toFixed(1) }} {{ unitSystem === 'SI' ? 'm²' : 'ft²' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Overdesign:</span>
                                <span class="data-value" :style="{ color: getOverdesignColor(simulationResults.overdesign), fontWeight: 'bold' }">
                                    {{ Math.abs(simulationResults.overdesign) < 0.05 ? '0.0' : (simulationResults.overdesign > 0 ? '+' + simulationResults.overdesign.toFixed(1) : simulationResults.overdesign.toFixed(1)) }}%
                                </span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Calc U:</span>
                                <span class="data-value">{{ simulationResults.U.toFixed(0) }} {{ unitSystem === 'SI' ? 'W/m²K' : 'BTU/h·ft²·°F' }}</span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Fouling Factor Rf:</span>
                                <span class="data-value">{{ simulationResults.Rf.toFixed(4) }}</span>
                            </div>
                            
                            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 5px 0;" />
                            
                            <div class="data-row">
                                <span class="data-label">Tube Velocity:</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>{{ simulationResults.v_tube.toFixed(1) }} {{ unitSystem === 'SI' ? 'm/s' : 'ft/s' }}</span>
                                    <span style="font-size: 12px; color: #64748b; margin-top: 2px;">
                                        Re: {{ simulationResults.Re_tube.toFixed(0) }} 
                                        <strong :style="{ color: simulationResults.Re_tube >= 4000 ? '#10b981' : (simulationResults.Re_tube < 2300 ? '#f59e0b' : '#3b82f6') }">
                                            [{{ simulationResults.Re_tube >= 4000 ? 'Turbulent' : (simulationResults.Re_tube < 2300 ? 'Laminar' : 'Transitional') }}]
                                        </strong>
                                    </span>
                                </span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Shell Velocity:</span>
                                <span class="data-value" style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span>{{ simulationResults.v_shell.toFixed(1) }} {{ unitSystem === 'SI' ? 'm/s' : 'ft/s' }}</span>
                                    <span style="font-size: 12px; color: #64748b; margin-top: 2px;">
                                        Re: {{ simulationResults.Re_shell.toFixed(0) }} 
                                        <strong :style="{ color: simulationResults.Re_shell >= 4000 ? '#10b981' : (simulationResults.Re_shell < 2300 ? '#f59e0b' : '#3b82f6') }">
                                            [{{ simulationResults.Re_shell >= 4000 ? 'Turbulent' : (simulationResults.Re_shell < 2300 ? 'Laminar' : 'Transitional') }}]
                                        </strong>
                                    </span>
                                </span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Tube ΔP:</span>
                                <span class="data-value">
                                    {{ simulationResults.dP_tube.toFixed(1) }} {{ unitSystem === 'SI' ? 'kPa' : 'psi' }}
                                    <span :class="simulationResults.dP_tube < (unitSystem === 'SI' ? 70 : 10) ? 'status-ok' : 'status-high'">
                                        [{{ simulationResults.dP_tube < (unitSystem === 'SI' ? 70 : 10) ? 'OK' : 'HIGH' }}]
                                    </span>
                                </span>
                            </div>
                            <div class="data-row">
                                <span class="data-label">Shell ΔP:</span>
                                <span class="data-value">
                                    {{ simulationResults.dP_shell.toFixed(1) }} {{ unitSystem === 'SI' ? 'kPa' : 'psi' }}
                                    <span :class="simulationResults.dP_shell < (unitSystem === 'SI' ? 70 : 10) ? 'status-ok' : 'status-high'">
                                        [{{ simulationResults.dP_shell < (unitSystem === 'SI' ? 70 : 10) ? 'OK' : 'HIGH' }}]
                                    </span>
                                </span>
                            </div>
                            <div v-if="simulationResults.dP_shell >= (unitSystem === 'SI' ? 70 : 10) || simulationResults.dP_tube >= (unitSystem === 'SI' ? 70 : 10)" class="data-row" style="margin-top: 5px;">
                                <span class="status-warn">*Warning: Pressure Drop Limits Exceeded*</span>
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
                <div style="background: #f8fafc; padding: 30px; border-radius: 12px; width: 90%; max-width: 800px; max-height: 85%; overflow-y: auto; display: flex; flex-direction: column; position: relative; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                    <button @click="toggleAbout" style="position: absolute; top: 15px; right: 20px; background: none; border: none; font-size: 28px; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
                    <!-- Centered LaTeX-style Title Block (maketitle) -->
                    <div style="text-align: center; margin-bottom: 25px; margin-top: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px;">
                        <h1 style="color: #143d70; font-size: 24px; font-weight: bold; margin-bottom: 10px; line-height: 1.2;">Shell and Tube Heat Exchanger Model</h1>
                        <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 4px;">Benjamin Lillywhite</div>
                        <div style="font-size: 13px; color: #475569; font-family: monospace; margin-bottom: 4px;">
                            <a href="mailto:Benjamin.Lillywhite@student.montana.edu" style="color: #475569; text-decoration: none;">Benjamin.Lillywhite@student.montana.edu</a>
                        </div>
                        <div style="font-size: 13px; color: #64748b; font-style: italic;">
                            Montana State University &bull; Chemical Engineering, Class of '28
                        </div>
                    </div>
                    <div style="font-size: 15px; line-height: 1.6; color: #334155;">
                        <h3 style="color: #0f172a; margin-top: 15px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">1. Overview</h3>
                        <p>Shell and tube heat exchangers are widely used in industry, in places such as oil refineries, power plants, and chemical processing facilities. Within a shell and tube heat exchanger, heat is transferred between two fluids that are separated and not mixed. One fluid flows inside the tubes, and the other flows through the surrounding shell at a different temperature. Through this model, it is possible to design a simple shell and tube heat exchanger and generate output results.</p>

                        <h3 style="color: #0f172a; margin-top: 25px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">2. Methods and Equations</h3>
                        <p>The fundamental thermodynamic behavior is governed by the Log Mean Temperature Difference (LMTD) method and the Effectiveness-NTU (\\(\\varepsilon\\)-NTU) method.</p>

                        <h4 style="color: #1e293b; margin-top: 20px; font-weight: 600;">2.1 Effectiveness-NTU Method</h4>
                        <p>When given an existing heat exchanger design, the NTU (number of transfer units) method allows us to predict the outlet temperatures.</p>
                        <p>The value for NTU is defined as:</p>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            $$ NTU = \\frac{U A_s}{C_{\\text{min}}} $$
                        </div>
                        <p>Where:</p>
                        <ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">
                            <li style="margin-bottom: 8px;"><strong>\\(U\\)</strong> is the overall heat transfer coefficient (\\(\\text{W}/(\\text{m}^2\\cdot\\text{K})\\))</li>
                            <li style="margin-bottom: 8px;"><strong>\\(A_s\\)</strong> is the heat transfer surface area (\\(\\text{m}^2\\))
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-top: 10px; margin-bottom: 10px; margin-left: 20px; max-width: 95%;">
                                    $$ A_s = N \\cdot \\pi \\cdot D_o \\cdot L $$
                                </div>
                            </li>
                            <li style="margin-bottom: 8px;"><strong>\\(C_{\\text{min}}\\)</strong> is the minimum heat capacity rate (\\(\\text{W}/\\text{K}\\)), defined as the smaller value between the hot and cold fluid heat capacity rates (\\(\\min(C_H, C_C)\\))</li>
                        </ul>

                        <p style="margin-top: 20px;">The maximum heat transfer rate (\\(Q_{\\text{max}}\\) in \\(\\text{W}\\)) is defined as:</p>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            $$ Q_{\\text{max}} = C_{\\text{min}} (T_{H,\\text{in}} - T_{C,\\text{in}}) $$
                        </div>

                        <p>The effectiveness can be shown as:</p>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            $$ \\epsilon = \\frac{Q_{\\text{actual}}}{Q_{\\text{max}}} $$
                        </div>

                        <p>The outlet temperatures of the heat exchanger can be found via the first law of thermodynamics:</p>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                            $$ Q_{\\text{actual}} = \\dot{m_h} \\cdot C_{p,h} \\cdot (T_{\\text{h,in}}-T_{\\text{h,out}}) $$
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            $$ Q_{\\text{actual}} = \\dot{m_c} \\cdot C_{p,c} \\cdot (T_{\\text{c,out}}-T_{\\text{c,in}}) $$
                        </div>
                        <p>Where:</p>
                        <ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">
                            <li style="margin-bottom: 8px;"><strong>\\(\\dot{m}\\)</strong> is the mass flow rate (\\(\\text{kg}/\\text{s}\\))</li>
                            <li style="margin-bottom: 8px;"><strong>\\(C_p\\)</strong> is the specific heat capacity (\\(\\text{J}/(\\text{kg}\\cdot\\text{K})\\))</li>
                        </ul>

                        <h4 style="color: #1e293b; margin-top: 25px; font-weight: 600;">2.2 Log Mean Temperature Difference Method (LMTD)</h4>
                        <p>When trying to determine the size of a heat exchanger to achieve a desired output temperature the LMTD method is used.</p>
                        <p>The total heat transfer rate \\(Q\\) (\\(\\text{W}\\)) is defined as:</p>
                        <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            $$ Q = U \\cdot A_s \\cdot F \\cdot \\Delta T_{lm} $$
                        </div>
                        <p>Where:</p>
                        <ul style="margin-top: 5px; padding-left: 20px; list-style-type: disc;">
                            <li style="margin-bottom: 8px;"><strong>\\(F\\)</strong> is defined as the correction factor (Dimensionless).</li>
                            <li style="margin-bottom: 8px;"><strong>\\(\\Delta T_{lm}\\)</strong> (\\(\\text{K}\\)) is defined as:
                                <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; margin-top: 10px; margin-bottom: 10px; margin-left: 20px; max-width: 95%;">
                                    $$ \\Delta T_{lm} = \\frac{\\Delta T_1 - \\Delta T_2}{\\ln\\left(\\frac{\\Delta T_1}{\\Delta T_2}\\right)} $$
                                </div>
                            </li>
                        </ul>

                        <h3 style="color: #0f172a; margin-top: 30px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">3. Takeaways</h3>
                        <p>It is important to note that shell and tube heat exchangers can become much more complex than what the model shows. Baffles, fins, and other implementations can be added to the heat exchangers to increase heat transfer. This model is intended to show the general behavior of a simple shell and tube heat exchanger.</p>
                    </div>
                </div>
            </div>
            </div>

            <!-- Graphs removed from modal overlay and embedded into drawer -->
        </div>
    `
};

createApp(App).mount('#app');
