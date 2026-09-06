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

There are two methods of calculation in this model. The effectiveness- NTU method and the log mean temperature difference (LMTD) method. The NTU method will calculate the heat transfer rate, outlet temperatures and the effectiveness. The LMTD method will calculate the surface area required for the heat exchanger to reach some given output temperatures, the log mean temperature difference, and the correction factor F. 

To learn more about the calculations behind the model click "About This Model" within the live demo. 


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
