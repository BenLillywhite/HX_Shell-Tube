/**
 * Thermodynamic Fluid Database
 * Contains industry-standard fluid properties, boiling points, and freezing points.
 */
export const FluidDatabase = {
    "Water": {
        cp: 4.182,
        rho: 998.2,
        mu: 0.001002,
        k: 0.598,
        minT: 0,
        maxT: 100,
        description: "Standard utility cooling or heating across all manufacturing plants."
    },
    "Engine Oil (Light Mineral Oil)": {
        cp: 1.950,
        rho: 880,
        mu: 0.050,
        k: 0.14,
        minT: -18,
        maxT: 250,
        description: "Lube oil cooling loops, mechanical machinery thermal regulation."
    },
    "Ethylene Glycol (Pure)": {
        cp: 2.385,
        rho: 1113.5,
        mu: 0.0198,
        k: 0.258,
        minT: -12.9,
        maxT: 197.3,
        description: "Industrial refrigeration loops, HVAC chillers, closed-loop anti-freeze."
    },
    "Methanol": {
        cp: 2.53,
        rho: 791.4,
        mu: 0.000544,
        k: 0.203,
        minT: -97.6,
        maxT: 64.7,
        description: "Petrochemical solvent loops, low-temperature process chilling."
    },
    "Ethanol": {
        cp: 2.44,
        rho: 789.3,
        mu: 0.001074,
        k: 0.170,
        minT: -114.1,
        maxT: 78.4,
        description: "Distilleries, biofuel refining, chemical synthesizer plants."
    },
    "Benzene": {
        cp: 1.725,
        rho: 878.6,
        mu: 0.000604,
        k: 0.144,
        minT: 5.5,
        maxT: 80.1,
        description: "Aromatic hydrocarbon processing, plastics manufacturing feeds."
    },
    "Acetone": {
        cp: 2.15,
        rho: 789.9,
        mu: 0.000316,
        k: 0.160,
        minT: -94.7,
        maxT: 56.0,
        description: "Pharmaceutical solvent washing, paint/coating manufacturing lines."
    },
    "Dowtherm A (Therminol 66)": {
        cp: 1.56,
        rho: 1060,
        mu: 0.0039,
        k: 0.138,
        minT: 12.0,
        maxT: 400.0,
        description: "High-temperature synthetic heat transfer fluids (thermal oils)."
    }
};

export const MaterialDatabase = {
    "Carbon Steel": { k: 45.0, description: "Standard utility piping." },
    "Stainless Steel 304/316": { k: 15.0, description: "Corrosion resistant process tubing." },
    "Copper-Nickel": { k: 40.0, description: "Seawater and brackish environments." },
    "Titanium": { k: 16.0, description: "High corrosion and extreme service." }
};

export const FoulingDatabase = {
    "Demineralized/Treated Water": { Rf: 0.0001, description: "Very clean, minimal scale buildup." },
    "Standard City Tap Water": { Rf: 0.0002, description: "Moderate scaling over time." },
    "Cooling Tower Water": { Rf: 0.0003, description: "Typical industrial default; accounts for algae and mineral deposits." },
    "Muddy/River Water": { Rf: 0.0006, description: "High silt and particulate matter; heavily penalizes heat transfer." }
};
