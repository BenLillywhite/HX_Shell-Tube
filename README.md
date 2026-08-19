# Shell & Tube Heat Exchanger (S&T HX) Design & Simulation Suite

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://benlillywhite.github.io/HX_Shell-Tube/)


An interactive tool for designing, sizing, and simulating simple shell and tube heat exchangers. The model uses a JavaScript based thermodynamic calculation engine to perform heat transfer and fluid flow calculations, with interactive visualizations to show the results.

---

## Browser Access

This application runs using standard ES modules and HTML5 Canvas. Anyone can use the live tool directly in their browser without installing any software or running a local server:

**[Launch Interactive Live Demo](https://benlillywhite.github.io/HX_Shell-Tube/)** 

![image alt](https://github.com/BenLillywhite/HX_Shell-Tube/blob/main/Screenshot%202026-08-18%20145555.jpg?raw=true)
---

## Key Features

- **Thermodynamic NTU- Calculation Engine**:
  - Implementation of the Number of Transfer Units ($\text{NTU}$) - Effectiveness ($\varepsilon$) method for counter-flow, parallel-flow, and multi-pass shell and tube configurations.
  - Automatic calculation of overall heat transfer coefficients ($U$), fouling resistances ($R_f$), mean temperature differences ($\text{LMTD}$), and $F$-factor geometry corrections.
  - Fluid flow regime determination (Laminar, Transitional, Turbulent) based on shell & tube side Reynolds numbers ($Re$).
  - Friction factor and pressure drop calculations ($\Delta P$) for shell and tube sides.

- **Real-Time HTML5 Canvas Visualizer**:
  - Animated fluid particles matching mass flow rate and velocity.
  - HSL color gradients mapping temperature profiles from inlet to outlet.

- **Engineering Controls & Databases**:
  - **Fluid Databases**: Pre-configured thermodynamic properties ($\rho, c_p, \mu, k$) for water, engine Oil, ethylene glycol, methanol, ethanol, benzene, acetone, and Dowtherm A
  - **Material Databases**: Thermal conductivity values ($k$) for Carbon Steel, Stainless Steel (316/304), Copper, and Titanium.
  - **Fouling Margins**: Fouling resistances for treatable plant water, standard city tap water, cooling tower water, and muddy water.

- **Unit Conversion**:
  - Instant conversion between **Metric (SI)** ($^\circ\text{C}, \text{kg/s}, \text{kW}, \text{kPa}, \text{W/m}^2\text{K}$) and **English (Imperial)** ($^\circ\text{F}, \text{lb/hr}, \text{BTU/hr}, \text{psi}, \text{BTU/hr}\cdot\text{ft}^2\cdot^\circ\text{F}$).


---

## Technology Stack

- **Frontend Core**: Standard HTML5, CSS3, JavaScript (ES6+ Modules)
- **UI Framework**: Vue.js 3 (ESM Browser Build - zero build step required)
- **Visualization**: HTML5 2D Canvas API (High DPI Render Loop)
- **Charts & Math**: Chart.js 4.x, MathJax 3.x
- **Optional Web Server**: Python 3 / Django 6.0

---


---

## License

Distributed under the MIT License. See `LICENSE` for more information.
