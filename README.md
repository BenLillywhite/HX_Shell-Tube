# Shell & Tube Heat Exchanger (S&T HX) Design & Simulation Suite

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://benlillywhite.github.io/HX_Shell-Tube/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Technology](https://img.shields.io/badge/Tech-Vue.js%203%20%7C%20HTML5%20Canvas%20%7C%20Django-0052CC?style=for-the-badge)](https://benlillywhite.github.io/HX_Shell-Tube/)

An interactive, high-performance engineering suite for designing, sizing, and simulating **Shell and Tube Heat Exchangers**. Built with a modular JavaScript thermodynamic calculation engine, real-time HTML5 Canvas animation, and interactive analytical graphs.

---

## Live Demo (Instant Browser Access)

This application runs **100% client-side** using standard ES modules and HTML5 Canvas. Anyone can use the live tool directly in their browser without installing any software or running a local server:

**[Launch Interactive Live Demo](https://benlillywhite.github.io/HX_Shell-Tube/)** *(Or click the GitHub Pages link in the repository header)*

---

## Key Features

- **Thermodynamic $\text{NTU}-\varepsilon$ Calculation Engine**:
  - Full implementation of the Number of Transfer Units ($\text{NTU}$) - Effectiveness ($\varepsilon$) method for counter-flow, parallel-flow, and multi-pass shell and tube configurations.
  - Automatic calculation of overall heat transfer coefficients ($U$), fouling resistances ($R_f$), mean temperature differences ($\text{LMTD}$), and $F$-factor geometry corrections.
  - Fluid flow regime determination (Laminar, Transitional, Turbulent) based on shell & tube side Reynolds numbers ($Re$).
  - Friction factor and pressure drop calculations ($\Delta P$) for shell and tube sides.

- **Real-Time HTML5 Canvas Visualizer**:
  - Live animated fluid particles matching mass flow rate and velocity.
  - Dynamic HSL color gradients mapping temperature profiles from inlet to outlet.
  - Structural geometry visualization for single-pass and multi-pass (U-bend / longitudinal baffle) shell & tube arrangements.

- **Engineering Controls & Databases**:
  - **Fluid Databases**: Pre-configured thermodynamic properties ($\rho, c_p, \mu, k$) for Water, Engine Oil, Ethylene Glycol, Therminol 66, Crude Oil, and Air.
  - **Material Databases**: Thermal conductivity values ($k$) for Carbon Steel, Stainless Steel (316/304), Copper, Brass, and Titanium.
  - **Fouling Margins**: Standard TEMA fouling resistances for treatable plant water, seawater, engine oils, and organic solvents.

- **Dual Unit System Support**:
  - Instant conversion between **Metric (SI)** ($^\circ\text{C}, \text{kg/s}, \text{kW}, \text{kPa}, \text{W/m}^2\text{K}$) and **English (Imperial)** ($^\circ\text{F}, \text{lb/hr}, \text{BTU/hr}, \text{psi}, \text{BTU/hr}\cdot\text{ft}^2\cdot^\circ\text{F}$).

- **Analytics & Documentation**:
  - Integrated **Chart.js** drawer for plotting fractional temperature profiles ($T$ vs. $x/L$).
  - Educational reference modal with **MathJax** rendered thermodynamic formulas and derivations.

---

## Technology Stack

- **Frontend Core**: Standard HTML5, CSS3, JavaScript (ES6+ Modules)
- **UI Framework**: Vue.js 3 (ESM Browser Build - zero build step required)
- **Visualization**: HTML5 2D Canvas API (High DPI Render Loop)
- **Charts & Math**: Chart.js 4.x, MathJax 3.x
- **Optional Web Server**: Python 3 / Django 6.0

---

## Architecture & File Structure

```text
HX-MODEL/
├── index.html            # Static entry point for GitHub Pages deployment
├── main.js               # Vue 3 application controller & UI state manager
├── engine.js             # Standalone thermodynamic calculation & simulation engine
├── render.js             # High-performance HTML5 Canvas renderer & particle system
├── database.js           # Fluid, material, and fouling factor databases
├── styles.css            # Custom responsive layout & modern design system
├── start_server.sh       # Local Django development server launcher
├── manage.py             # Django management CLI
└── temp_hx_project/      # Django backend project wrapper
```

---

## Local Development Setup

### Method 1: Instant Static Server (No Installation Needed)
Since the app uses standard ES Modules, you can open `index.html` directly in any web browser or use a simple HTTP server:
```bash
# Using Python builtin HTTP server
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

### Method 2: Running with Django
If you prefer running the Django development server:
```bash
chmod +x start_server.sh
./start_server.sh
# Open http://127.0.0.1:8000 in your browser
```

---

## Deploying to GitHub Pages

To publish your live demo on GitHub Pages:
1. Push your repository to GitHub.
2. Go to your repository **Settings** tab on GitHub.
3. Click on **Pages** in the left sidebar menu.
4. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
5. Under **Branch**, select `main` and set the folder to `/ (root)`.
6. Click **Save**. Within 1–2 minutes, your project will be live at:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
