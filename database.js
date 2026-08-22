/**
 * Thermodynamic Fluid Database
 * Contains industry-standard fluid properties, boiling points, and freezing points.
 */
export const FluidDatabase = {
    "Water": {
        description: "Operating temperature: 0.01 to 100 C.",
        temperature: [0.01, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
        rho: [999.8, 999.9, 999.7, 999.1, 998.0, 997.0, 996.0, 994.0, 992.1, 990.1, 988.1, 985.7, 983.2, 980.6, 977.8, 975.0, 971.8, 968.1, 965.3, 962.1, 957.9],
        cp: [4.217, 4.205, 4.194, 4.185, 4.182, 4.180, 4.178, 4.178, 4.179, 4.180, 4.181, 4.183, 4.185, 4.187, 4.190, 4.193, 4.197, 4.201, 4.206, 4.212, 4.217],
        k: [0.561, 0.571, 0.580, 0.589, 0.598, 0.607, 0.615, 0.623, 0.631, 0.637, 0.644, 0.649, 0.654, 0.659, 0.663, 0.667, 0.670, 0.673, 0.675, 0.677, 0.679],
        mu: [0.001792, 0.001519, 0.001307, 0.001138, 0.001002, 0.000891, 0.000798, 0.000720, 0.000653, 0.000596, 0.000547, 0.000504, 0.000467, 0.000433, 0.000404, 0.000378, 0.000355, 0.000335, 0.000315, 0.000297, 0.000282],
        minT: 0.01,
        maxT: 100
    },
    "Methanol": {
        description: "Operating temperature: 20 to 70 C.",
        temperature: [20, 30, 40, 50, 60, 70],
        rho: [788.4, 779.1, 769.6, 760.1, 750.4, 740.4],
        cp: [2.515, 2.577, 2.644, 2.718, 2.795, 2.885],
        k: [0.1987, 0.1980, 0.1972, 0.1965, 0.1957, 0.1950],
        mu: [0.0005857, 0.0005088, 0.0004460, 0.0003942, 0.0003516, 0.0003146],
        minT: 20,
        maxT: 70
    },
    "Isobutane (R600a)": {
        description: "Operating temperature: -100 to 100 C.",
        temperature: [-100, -75, -50, -25, 0, 25, 50, 75, 100],
        rho: [683.8, 659.3, 634.4, 608.2, 580.6, 550.7, 517.3, 478.5, 429.6],
        cp: [1.881, 1.970, 2.069, 2.180, 2.306, 2.455, 2.640, 2.896, 3.361],
        k: [0.1383, 0.1357, 0.1323, 0.1185, 0.1068, 0.0956, 0.0851, 0.0757, 0.0669],
        mu: [0.0009305, 0.0005762, 0.0003779, 0.0002628, 0.0001956, 0.0001510, 0.0001155, 0.000087485, 0.00006494],
        minT: -100,
        maxT: 100
    },
    "Glycerin": {
        description: "Operating temperature: 0 to 40 C.",
        temperature: [0, 5, 10, 15, 20, 25, 30, 35, 40],
        rho: [1276, 1273, 1272, 1267, 1264, 1261, 1258, 1255, 1252],
        cp: [2.262, 2.288, 2.320, 2.354, 2.386, 2.416, 2.447, 2.478, 2.513],
        k: [0.2820, 0.2835, 0.2846, 0.2856, 0.2860, 0.2860, 0.2860, 0.2863, 0.2863],
        mu: [10.49, 6.730, 4.241, 2.496, 1.519, 0.9934, 0.6582, 0.4347, 0.3073],
        minT: 0,
        maxT: 40
    },
    "Engine Oil (unused)": {
        description: "Operating temperature: 0 to 140 C.",
        temperature: [0, 20, 40, 60, 80, 100, 120, 140],
        rho: [899.0, 888.1, 876.0, 863.9, 852.0, 840.0, 828.9, 816.8],
        cp: [1.797, 1.881, 1.964, 2.048, 2.132, 2.220, 2.308, 2.395],
        k: [0.1469, 0.1450, 0.1444, 0.1404, 0.1380, 0.1367, 0.1367, 0.1330],
        mu: [3.814, 0.8374, 0.2177, 0.07399, 0.03232, 0.01718, 0.01029, 0.006558],
        minT: 0,
        maxT: 140
    },
    "Sodium-Potassium (NaK)": {
        description: "Operating temperature: 100 to 600 C.",
        temperature: [100, 200, 300, 400, 500, 600],
        rho: [847.3, 823.2, 799.1, 775.0, 751.5, 728.0],
        cp: [0.9444, 0.9225, 0.9006, 0.8790, 0.8511, 0.8288],
        k: [85.84, 65.39, 54.07, 46.26, 40.37, 35.50],
        mu: [0.000007432, 0.000005572, 0.000004418, 0.000003041, 0.000002805, 0.000002533],
        minT: 100,
        maxT: 600
    },
    "Bismuth": {
        description: "Operating temperature: 350 to 700 C.",
        temperature: [350, 400, 450, 500, 550, 600, 650, 700],
        rho: [9969, 9908, 9838, 9785, 9663, 9554, 9446, 9340],
        cp: [0.1460, 0.1482, 0.1500, 0.1528, 0.1573, 0.1618, 0.1630, 0.1650],
        k: [16.28, 16.10, 15.74, 15.54, 15.74, 15.60, 15.30, 14.91],
        mu: [0.001540, 0.001442, 0.001884, 0.001188, 0.001013, 0.0009136, 0.0008876, 0.0008736],
        minT: 350,
        maxT: 700
    }
};

export function getFluidProperties(fluid, temperature) {
    const temperatures = fluid.temperature;
    const clampTemperature = Math.max(temperatures[0], Math.min(temperature, temperatures[temperatures.length - 1]));
    let upperIndex = temperatures.findIndex(value => value >= clampTemperature);
    if (upperIndex < 0) upperIndex = temperatures.length - 1;
    if (upperIndex === 0) upperIndex = 1;

    const lowerIndex = upperIndex - 1;
    const fraction = (clampTemperature - temperatures[lowerIndex]) / (temperatures[upperIndex] - temperatures[lowerIndex]);
    const interpolate = values => values[lowerIndex] + fraction * (values[upperIndex] - values[lowerIndex]);

    return {
        cp: interpolate(fluid.cp),
        rho: interpolate(fluid.rho),
        mu: interpolate(fluid.mu),
        k: interpolate(fluid.k)
    };
}

export const MaterialDatabase = {
    "Carbon Steel": { k: 45.0, description: "Standard utility piping." },
    "Stainless Steel 304/316": { k: 16.0, description: "Corrosion resistant process tubing." },
    "Copper-Nickel (90 Cu - 10 Ni)": { k: 71.0, description: "Seawater and brackish environments." },
    "Titanium": { k: 19.0, description: "High corrosion and extreme service." }
};

export const FoulingDatabase = {
    "Demineralized/Treated Water": { Rf: 0.0001, description: "Very clean, minimal scale buildup." },
    "Standard City Tap Water": { Rf: 0.0002, description: "Moderate scaling over time." },
    "Cooling Tower Water": { Rf: 0.0003, description: "Typical industrial default; accounts for algae and mineral deposits." },
    "Muddy/River Water": { Rf: 0.0006, description: "High silt and particulate matter; heavily penalizes heat transfer." }
};
