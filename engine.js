/**
 * Heat Exchanger Physics Engine (V2)
 * Dynamic Surface Area calculations and Effectiveness-NTU methods.
 */
export class HeatExchangerEngine {
    constructor() {
        this.numSegments = 20;
    }

    // SI <-> English Conversion Factors
    static CONV = {
        in_to_m: 0.0254,
        m_to_in: 39.3701,
        ft_to_m: 0.3048,
        m_to_ft: 3.28084,
        sqft_to_sqm: 0.092903,
        sqm_to_sqft: 10.7639,
        U_eng_to_si: 5.67826, // BTU/(hr·ft²·°F) -> W/m²K
        U_si_to_eng: 0.17611, // W/m²K -> BTU/(hr·ft²·°F)
        k_eng_to_si: 1.73073, // BTU/(hr·ft·°F) -> W/mK
        massflow_eng_to_si: 0.000125998, // lb/hr -> kg/s
        massflow_si_to_eng: 7936.64, // kg/s -> lb/hr
        cp_eng_to_si: 4.1868, // BTU/(lb·°F) -> kJ/kgK
        rho_eng_to_si: 16.0185, // lb/ft³ -> kg/m³
        mu_eng_to_si: 0.00041338, // lb/(ft·hr) -> Pa·s
        power_si_to_eng: 3412.14, // kW -> BTU/hr
        pressure_si_to_eng: 0.145038 // kPa -> psi
    };

    static F_to_C(f) { return (f - 32) * 5/9; }
    static C_to_F(c) { return c * 9/5 + 32; }

    calculate(uiConfig, unitSystem = 'SI') {
        let config = uiConfig;
        
        // --- TRANSLATION LAYER: INPUT ---
        if (unitSystem === 'English') {
            config = JSON.parse(JSON.stringify(uiConfig));
            const C = HeatExchangerEngine.CONV;
            
            config.shell.diameter *= C.in_to_m;
            if (config.useCustomU) config.customU *= C.U_eng_to_si;
            config.tube.length *= C.ft_to_m;
            config.tube.outerDiameter *= C.in_to_m;
            if (config.tube.k_material) config.tube.k_material *= C.k_eng_to_si;
            
            const translateFluid = (f) => {
                f.tempIn = HeatExchangerEngine.F_to_C(f.tempIn);
                f.massFlow *= C.massflow_eng_to_si;
                f.cp *= C.cp_eng_to_si;
                if (f.rho) f.rho *= C.rho_eng_to_si;
                if (f.mu) f.mu *= C.mu_eng_to_si;
                if (f.k) f.k *= C.k_eng_to_si;
                if (f.Rf) f.Rf *= C.U_si_to_eng; // m2K/W -> hr-ft2-F/BTU = U_si_to_eng! Wait:
                // Rf is resistance. So R_si = 1/U_si. R_eng = 1/U_eng. 
                // Since U_si = U_eng * 5.678, R_si = R_eng / 5.678 => R_eng * 0.17611.
            };
            
            translateFluid(config.hotFluid);
            translateFluid(config.coldFluid);
        }
        // Calculate dynamic surface area A = N_total * pi * D * L
        const totalTubes = config.tube.tubesPerPass * config.tube.passes;
        const A = totalTubes * Math.PI * config.tube.outerDiameter * config.tube.length;
        
        // Fluid Properties (assuming config contains rho, mu, k, cp)
        const rho_hot = config.hotFluid.rho || 850;
        const mu_hot = config.hotFluid.mu || 0.05;
        const k_hot = config.hotFluid.k || 0.14;
        
        const rho_cold = config.coldFluid.rho || 998;
        const mu_cold = config.coldFluid.mu || 0.001;
        const k_cold = config.coldFluid.k || 0.6;

        // Tube Geometry
        const Di = config.tube.outerDiameter - 0.004; // Assume 2mm wall thickness
        const Do = config.tube.outerDiameter;

        // 1. Calculate Velocities
        const tubesPerPass = config.tube.tubesPerPass;
        const flowAreaTube = tubesPerPass * Math.PI * Math.pow(Di, 2) / 4;
        const v_tube = config.coldFluid.massFlow / (rho_cold * flowAreaTube);
        
        const baffleSpacing = 0.2 * config.shell.diameter; // approx 20% of shell diameter
        const flowAreaShell = config.shell.diameter * baffleSpacing * 0.5; // approx free flow area
        const v_shell = config.hotFluid.massFlow / (rho_hot * flowAreaShell);

        // 2. Tube-Side Convection (h_tube) via Dittus-Boelter
        const Re_tube = (rho_cold * v_tube * Di) / mu_cold;
        const Pr_tube = ((config.coldFluid.cp * 1000) * mu_cold) / k_cold;
        
        let h_tube = 1000;
        if (Re_tube > 2300) {
            const Nu_tube = 0.023 * Math.pow(Re_tube, 0.8) * Math.pow(Pr_tube, 0.4);
            h_tube = (Nu_tube * k_cold) / Di;
        } else {
            h_tube = (4.36 * k_cold) / Di;
        }

        // 3. Shell-Side Convection (h_shell) via Simplified Kern
        const De = Do; 
        const Re_shell = (rho_hot * v_shell * De) / mu_hot;
        const Pr_shell = ((config.hotFluid.cp * 1000) * mu_hot) / k_hot;
        
        let h_shell = 500;
        if (Re_shell > 10) {
            const Nu_shell = 0.36 * Math.pow(Re_shell, 0.55) * Math.pow(Pr_shell, 0.333);
            h_shell = (Nu_shell * k_hot) / De;
        }

        // 4. Wall Resistance
        const k_wall = config.tube.k_material || 45.0; // W/mK
        const R_wall = (Do / (2 * k_wall)) * Math.log(Do / Di);

        // 5. Fouling Resistances
        const Rf_hot = config.hotFluid.Rf || 0;
        const Rf_cold = config.coldFluid.Rf || 0;
        const Rf_total = Rf_hot + Rf_cold;

        // 6. Overall Heat Transfer Coefficient U
        const area_ratio = Do / Di;
        const U_clean_inv = (1 / h_shell) + R_wall + (area_ratio * (1 / h_tube));
        const U = 1 / U_clean_inv;

        const U_dirty_inv = U_clean_inv + Rf_hot + (area_ratio * Rf_cold);
        let U_dirty = 1 / U_dirty_inv;

        // Custom U Override
        if (config.useCustomU) {
            U_dirty = config.customU;
        }

        const UkW = U_dirty / 1000;
        const Rf = Rf_total;
        
        const C_h = config.hotFluid.massFlow * config.hotFluid.cp;
        const C_c = config.coldFluid.massFlow * config.coldFluid.cp;
        
        const C_min = Math.min(C_h, C_c);
        const C_max = Math.max(C_h, C_c);
        const C_r = C_min / C_max;
        
        const NTU = (UkW * A) / C_min;
        
        const n_shell = config.shell.passes || 1;
        const NTU_1 = NTU / n_shell;
        
        let epsilon_1 = 0;
        
        if (config.tube.passes > n_shell) {
            // Standard formula for 1 Shell Pass, and any Even number of Tube Passes
            const sqrtTerm = Math.sqrt(1 + C_r * C_r);
            const expTerm = Math.exp(-NTU_1 * sqrtTerm);
            const num = 1 + expTerm;
            const den = 1 - expTerm;
            epsilon_1 = 2 / (1 + C_r + sqrtTerm * (num / den));
        } else {
            // Single Pass per shell
            if (config.tube.flowArrangement === 'parallel') {
                const c = 1 + C_r;
                epsilon_1 = (1 - Math.exp(-NTU_1 * c)) / c;
            } else {
                // Counter Flow
                if (Math.abs(C_r - 1) < 0.001) {
                    epsilon_1 = NTU_1 / (1 + NTU_1);
                } else {
                    const expTerm = Math.exp(-NTU_1 * (1 - C_r));
                    epsilon_1 = (1 - expTerm) / (1 - C_r * expTerm);
                }
            }
        }
        
        // Cascade equation for n shell passes
        let epsilon = epsilon_1;
        if (n_shell > 1) {
            if (Math.abs(C_r - 1) < 0.001) {
                epsilon = (n_shell * epsilon_1) / (1 + (n_shell - 1) * epsilon_1);
            } else {
                const ratio = (1 - epsilon_1 * C_r) / (1 - epsilon_1);
                const ratio_n = Math.pow(ratio, n_shell);
                epsilon = (ratio_n - 1) / (ratio_n - C_r);
            }
        }
        
        const maxHeatTransfer = C_min * (config.hotFluid.tempIn - config.coldFluid.tempIn);
        const Q = epsilon * maxHeatTransfer;
        
        const hotTempOut = config.hotFluid.tempIn - (Q / C_h);
        const coldTempOut = config.coldFluid.tempIn + (Q / C_c);
        
        const profile = this.calculateProfile(config, Q, hotTempOut, coldTempOut, A, UkW, C_h, C_c);
        
        // --- Extended Calculations for Dashboard ---
        // LMTD
        const dT1 = config.hotFluid.tempIn - coldTempOut;
        const dT2 = hotTempOut - config.coldFluid.tempIn;
        let LMTD = 0;
        if (Math.abs(dT1 - dT2) < 0.01) {
            LMTD = dT1;
        } else {
            LMTD = (dT1 - dT2) / Math.log(dT1 / dT2);
        }
        
        // F-Factor Approximation (Simplified for 1-N pass)
        let F_factor = 1.0;
        if (config.tube.passes > 1) {
            const P = (coldTempOut - config.coldFluid.tempIn) / (config.hotFluid.tempIn - config.coldFluid.tempIn);
            const R = (config.hotFluid.tempIn - hotTempOut) / (coldTempOut - config.coldFluid.tempIn);
            if (Math.abs(R - 1) > 0.01) {
                const num = Math.sqrt(R*R + 1) * Math.log((1 - P) / (1 - P*R));
                let denTerm = (2 - P*(R + 1 - Math.sqrt(R*R + 1))) / (2 - P*(R + 1 + Math.sqrt(R*R + 1)));
                if (denTerm <= 0) denTerm = 0.0001; // prevent NaN
                const den = (R - 1) * Math.log(denTerm);
                F_factor = Math.max(0.1, Math.min(1.0, num / den));
            }
        }
        if (isNaN(F_factor)) F_factor = 0.85; // Fallback
        
        // Required Area
        const A_req = Q / (U_dirty / 1000 * LMTD * F_factor);
        const overdesign = ((A - A_req) / A_req) * 100;
        
        // Hydraulics (Approximations for pressure drop)
        
        // Rough delta P (kPa)
        const dP_tube = (0.5 * rho_cold * Math.pow(v_tube, 2) * (0.02 * config.tube.length / Di) * config.tube.passes) / 1000;
        const dP_shell = (0.5 * rho_hot * Math.pow(v_shell, 2) * 20 * config.shell.passes) / 1000;
        
        let result = {
            A, Q, hotTempOut, coldTempOut, epsilon, profile,
            LMTD, F_factor, A_req, overdesign, U: U_dirty, Rf,
            v_tube, v_shell, dP_tube, dP_shell,
            Re_tube, Re_shell,
            NTU, C_r
        };

        // --- TRANSLATION LAYER: OUTPUT ---
        if (unitSystem === 'English') {
            const C = HeatExchangerEngine.CONV;
            result.A *= C.sqm_to_sqft;
            result.A_req *= C.sqm_to_sqft;
            result.Q *= C.power_si_to_eng;
            result.hotTempOut = HeatExchangerEngine.C_to_F(result.hotTempOut);
            result.coldTempOut = HeatExchangerEngine.C_to_F(result.coldTempOut);
            result.U *= C.U_si_to_eng;
            result.Rf *= C.U_eng_to_si; // inverse of U translation
            result.v_tube *= C.m_to_ft;
            result.v_shell *= C.m_to_ft;
            result.dP_tube *= C.pressure_si_to_eng;
            result.dP_shell *= C.pressure_si_to_eng;
            
            result.profile = result.profile.map(p => ({
                x: p.x,
                Th: HeatExchangerEngine.C_to_F(p.Th),
                Tc: HeatExchangerEngine.C_to_F(p.Tc),
                tubePasses: p.tubePasses.map(t => HeatExchangerEngine.C_to_F(t))
            }));
            
            // Note: LMTD is technically a temperature difference, so it scales by 1.8 (9/5)
            result.LMTD *= 9/5; 
        }
        
        return result;
    }
    
    calculateProfile(config, Q, hotTempOut, coldTempOut, A, UkW, C_h, C_c) {
        const segments = [];
        const dx = 1 / this.numSegments;
        
        for (let i = 0; i <= this.numSegments; i++) {
            const x = i * dx; 
            const Ax = A * x;
            
            let Th_x, Tc_x, tubePasses = [];
            
            if (config.tube.passes > 1) {
                // Non-linear textbook approximation for Multi-Pass
                const k_h = Math.max(0.1, (UkW * A) / C_h);
                const k_c = Math.max(0.1, (UkW * A) / (config.tube.passes * C_c));
                
                const exp_h = (z) => (1 - Math.exp(-k_h * z)) / (1 - Math.exp(-k_h));
                const exp_c = (z) => (1 - Math.exp(-k_c * z)) / (1 - Math.exp(-k_c));

                Th_x = config.hotFluid.tempIn - (config.hotFluid.tempIn - hotTempOut) * exp_h(x);
                
                // Approximate cold fluid passes
                const passes = config.tube.passes;
                const tempStep = (coldTempOut - config.coldFluid.tempIn) / passes;
                
                for(let p = 0; p < passes; p++) {
                    const passTempIn = config.coldFluid.tempIn + p * tempStep;
                    const passTempOut = config.coldFluid.tempIn + (p + 1) * tempStep;
                    
                    if (p % 2 === 0) {
                        // Forward pass (0 to 1)
                        tubePasses.push(passTempIn + (passTempOut - passTempIn) * exp_c(x));
                    } else {
                        // Backward pass (1 to 0)
                        tubePasses.push(passTempIn + (passTempOut - passTempIn) * exp_c(1 - x));
                    }
                }
                Tc_x = tubePasses.reduce((a, b) => a + b, 0) / passes;
            } else {
                if (config.tube.flowArrangement === 'parallel') {
                    // Parallel Flow Analytical Solution
                    const n = UkW * ((1 / C_c) + (1 / C_h));
                    const tempDiff_0 = config.hotFluid.tempIn - config.coldFluid.tempIn;
                    const tempDiff_x = tempDiff_0 * Math.exp(-n * Ax);
                    Tc_x = (C_h * config.hotFluid.tempIn + C_c * config.coldFluid.tempIn - C_h * tempDiff_x) / (C_h + C_c);
                    Th_x = config.hotFluid.tempIn - (C_c / C_h) * (Tc_x - config.coldFluid.tempIn);
                } else {
                    // Counter Flow Analytical Solution for 1 pass
                    const n = UkW * ((1 / C_c) - (1 / C_h));
                    if (Math.abs(C_c - C_h) < 0.001) {
                        const dT = Q / (UkW * A);
                        Th_x = config.hotFluid.tempIn - (config.hotFluid.tempIn - hotTempOut) * x;
                        Tc_x = Th_x - dT;
                    } else {
                        const Tc_0 = coldTempOut;
                        const tempDiff_x = (config.hotFluid.tempIn - Tc_0) * Math.exp(n * Ax);
                        Th_x = (tempDiff_x + Tc_0 - (C_h / C_c) * config.hotFluid.tempIn) / (1 - C_h / C_c);
                        Tc_x = Tc_0 - (C_h / C_c) * (config.hotFluid.tempIn - Th_x);
                    }
                }
                tubePasses.push(Tc_x);
            }
            
            segments.push({
                x,
                Th: Th_x,
                Tc: Tc_x,
                tubePasses
            });
        }
        return segments;
    }
}
