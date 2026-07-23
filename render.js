export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        // Dynamically size canvas
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.particles = [];
        this.lastTime = performance.now();
        this.animationId = null;
        this.config = null;
        this.result = null;
        
        this.draw = this.draw.bind(this);
    }
    
    start(config, result) {
        this.config = config;
        this.result = result;
        
        // Init particles for the continuous tube path
        this.particles = [];
        const totalParticles = config.tube.passes * 50; // Keep same density
        for (let i = 0; i < totalParticles; i++) {
            this.particles.push({
                distanceRatio: Math.random(),
                radiusOffset: Math.random(),
                speedOffset: Math.random() * 0.5 + 0.5
            });
        }
        
        // Init shell particles
        this.shellParticles = [];
        for (let j = 0; j < 250; j++) {
            this.shellParticles.push({
                x: Math.random(),
                y: Math.random(),
                speedOffset: Math.random() * 0.5 + 0.5
            });
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.lastTime = performance.now();
        this.draw();
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    getColorForTemp(temp, minTemp = 20, maxTemp = 150) {
        const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
        const r = Math.round(63 + ratio * (249 - 63));
        const g = Math.round(154 + ratio * (110 - 154));
        const b = Math.round(174 + ratio * (91 - 174));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    drawSegmentedBody(x, y, w, h, temps, minT, maxT) {
        if (!temps || temps.length === 0) return;
        const numSegments = temps.length - 1;
        const segmentWidth = w / numSegments;
        
        for (let i = 0; i < numSegments; i++) {
            const temp = temps[i];
            const nextTemp = temps[i+1];
            
            const x1 = x + i * segmentWidth;
            
            const gradient = this.ctx.createLinearGradient(x1, 0, x1 + segmentWidth, 0);
            gradient.addColorStop(0, this.getColorForTemp(temp, minT, maxT));
            gradient.addColorStop(1, this.getColorForTemp(nextTemp, minT, maxT));
            
            this.ctx.fillStyle = gradient;
            // Overlap slightly to prevent gaps
            this.ctx.fillRect(x1 - 1, y, segmentWidth + 2, h);
        }
    }
    
    roundedRectPath(x, y, w, h, r) {
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x, y, w, h, r);
        } else {
            this.ctx.moveTo(x + r, y);
            this.ctx.arcTo(x + w, y, x + w, y + h, r);
            this.ctx.arcTo(x + w, y + h, x, y + h, r);
            this.ctx.arcTo(x, y + h, x, y, r);
            this.ctx.arcTo(x, y, x + w, y, r);
            this.ctx.closePath();
        }
    }
    
    draw() {
        if (!this.config || !this.result) return;
        
        const parent = this.canvas.parentElement;
        if (parent && (this.canvas.width !== parent.clientWidth || this.canvas.height !== parent.clientHeight)) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
        }
        
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        const computedStyle = getComputedStyle(this.canvas);
        const textColor = computedStyle.getPropertyValue('--text-primary').trim() || '#1d3557';
        const strokeColor = computedStyle.getPropertyValue('--text-primary').trim() || '#333333';
        const bgColor = computedStyle.getPropertyValue('--bg-color').trim() || '#fffcf6';

        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const minT = this.config.coldFluid.tempIn;
        const maxT = this.config.hotFluid.tempIn;
        
        const shellPadding = 160;
        const shellWidth = this.width - shellPadding * 2;
        
        const baselineDiameter = 0.8;
        // Keep 80px padding so labels don't get cut off when maxed out
        const maxShellHeight = this.height - 80; 
        // At 0.8m, only take up 40% of the maximum available height
        const baselineHeight = maxShellHeight * 0.4; 
        
        // Visually fix the model image size to the 24-inch (0.6096m) size per user request
        const visualDiameter = 0.6096;
        let shellHeight = baselineHeight * (visualDiameter / baselineDiameter);
        // Clamp visually so it doesn't break out of the canvas, but don't limit the actual math
        shellHeight = Math.max(80, Math.min(shellHeight, maxShellHeight));
        
        const shellY = (this.height - shellHeight) / 2;
        
        const shellRadius = 16; // 16px rounded corners for a sleek premium look
        
        // Draw Shell Body (clipped to rounded corners)
        this.ctx.save();
        this.roundedRectPath(shellPadding, shellY, shellWidth, shellHeight, shellRadius);
        this.ctx.clip();
        
        const hotProfile = this.result.profile.map(p => p.Th);
        
        if (this.config.shell.passes === 2) {
            const mid = Math.floor(hotProfile.length / 2);
            const topProfile = hotProfile.slice(0, mid + 1);
            const bottomProfile = hotProfile.slice(mid).reverse();
            
            const baffleHeight = 24; // Size of the physical gap
            
            this.drawSegmentedBody(shellPadding, shellY, shellWidth, shellHeight / 2 - baffleHeight / 2, topProfile, minT, maxT);
            this.drawSegmentedBody(shellPadding, shellY + shellHeight / 2 + baffleHeight / 2, shellWidth, shellHeight / 2 - baffleHeight / 2, bottomProfile, minT, maxT);
        } else {
            this.drawSegmentedBody(shellPadding, shellY, shellWidth, shellHeight, hotProfile, minT, maxT);
        }
        this.ctx.restore();
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 4;
        this.roundedRectPath(shellPadding, shellY, shellWidth, shellHeight, shellRadius);
        this.ctx.stroke();
        
        if (this.config.shell.passes === 2) {
            const baffleHeight = 24;
            // Erase the middle of the shell (left wall and interior) to create the physical gap
            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(shellPadding - 4, shellY + shellHeight / 2 - baffleHeight / 2, shellWidth - 60 + 4, baffleHeight);
            
            // Fill the remaining gap on the right with the fluid color at the turning point, with 1px overlap to prevent sub-pixel white lines
            const mid = Math.floor(hotProfile.length / 2);
            this.ctx.fillStyle = this.getColorForTemp(hotProfile[mid], minT, maxT);
            this.ctx.fillRect(shellPadding + shellWidth - 61, shellY + shellHeight / 2 - baffleHeight / 2 - 1, 62, baffleHeight + 2);
            
            // Draw the baffle boundaries (top, bottom, and right edge)
            this.ctx.beginPath();
            this.ctx.moveTo(shellPadding, shellY + shellHeight / 2 - baffleHeight / 2);
            this.ctx.lineTo(shellPadding + shellWidth - 60, shellY + shellHeight / 2 - baffleHeight / 2);
            this.ctx.lineTo(shellPadding + shellWidth - 60, shellY + shellHeight / 2 + baffleHeight / 2);
            this.ctx.lineTo(shellPadding, shellY + shellHeight / 2 + baffleHeight / 2);
            this.ctx.stroke();
            
            // Re-draw the right outer shell border that was painted over by the gap fill
            this.ctx.beginPath();
            this.ctx.moveTo(shellPadding + shellWidth, shellY + shellHeight / 2 - baffleHeight / 2 - 1);
            this.ctx.lineTo(shellPadding + shellWidth, shellY + shellHeight / 2 + baffleHeight / 2 + 1);
            this.ctx.stroke();
        }
        
        // Draw Shell Ports (Inlet top-left, Outlet bottom-right or bottom-left)
        const portW = 60;
        const portH = 30;
        const inPortX = shellPadding + 30;
        const outPortX = this.config.shell.passes % 2 === 0 
            ? inPortX // 2-pass: U-turn means it exits on the same side
            : shellPadding + shellWidth - 30 - portW;
        
        // Shell Inlet (Top)
        this.ctx.fillStyle = this.getColorForTemp(this.config.hotFluid.tempIn, minT, maxT);
        this.ctx.fillRect(inPortX, shellY - portH, portW, portH);
        this.ctx.strokeRect(inPortX, shellY - portH, portW, portH);
        
        // Shell Outlet (Bottom)
        this.ctx.fillStyle = this.getColorForTemp(this.result.hotTempOut, minT, maxT);
        this.ctx.fillRect(outPortX, shellY + shellHeight, portW, portH);
        this.ctx.strokeRect(outPortX, shellY + shellHeight, portW, portH);
        
        // Port Labels
        this.ctx.fillStyle = textColor;
        this.ctx.font = 'bold 12px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Shell Inlet', inPortX + portW / 2, shellY - portH - 10);
        this.ctx.fillText('Shell Outlet', outPortX + portW / 2, shellY + shellHeight + portH + 20);
        
        // Draw Shell Particles
        if (this.shellParticles) {
            const shellSpeed = Math.max(5, this.config.hotFluid.massFlow * 3);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // Dark, semi-transparent
            
            const gapRatio = 24 / shellHeight;
            const rightGapBoundary = 1 - 60 / shellWidth;
            
            for (let p of this.shellParticles) {
                const actualSpeed = shellSpeed * p.speedOffset * dt;
                
                if (this.config.shell.passes === 2) {
                    if (p.y <= 0.5) {
                        // Top half flows L-to-R
                        p.x += actualSpeed / shellWidth;
                        if (p.x > 1) {
                            p.x = 1;
                            p.y = 0.5 + Math.random() * 0.5; // Flow into bottom half
                        }
                    } else {
                        // Bottom half flows R-to-L
                        p.x -= actualSpeed / shellWidth;
                        if (p.x < 0) {
                            p.x = 0;
                            p.y = Math.random() * 0.5; // Loop back to inlet
                        }
                    }
                } else {
                    // 1-pass flows L-to-R
                    p.x += actualSpeed / shellWidth;
                    if (p.x > 1) {
                        p.x = 0;
                        p.y = Math.random();
                    }
                }
                
                // Don't draw particles inside the solid longitudinal baffle
                const inSolidBaffle = this.config.shell.passes === 2 && 
                                    p.y > 0.5 - gapRatio/2 && 
                                    p.y < 0.5 + gapRatio/2 && 
                                    p.x < rightGapBoundary;
                                    
                if (!inSolidBaffle) {
                    const px = shellPadding + p.x * shellWidth;
                    const py = shellY + p.y * shellHeight;
                    
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
        
        // Draw Dynamic Tubes
        const passes = this.config.tube.passes;
        const shellPasses = this.config.shell.passes;
        const baffleHeight = 24;
        
        let tubeSpacingGlobal;
        if (shellPasses === 2) {
            const tubesPerHalf = passes / 2;
            const halfUsableHeight = (shellHeight / 2) - (baffleHeight / 2) - 40;
            tubeSpacingGlobal = halfUsableHeight / (tubesPerHalf + 1);
        } else {
            const totalTubeArea = shellHeight - 40;
            tubeSpacingGlobal = totalTubeArea / (passes + 1);
        }
        
        const tubeHeight = Math.max(10, Math.min(30, tubeSpacingGlobal * 0.6));
        
        const getTy = (pass) => {
            if (shellPasses === 2) {
                const tubesPerHalf = passes / 2;
                const halfUsableHeight = (shellHeight / 2) - 40 - 12; // 20px padding top and bottom
                const spacing = halfUsableHeight / (tubesPerHalf + 1);
                
                if (pass < tubesPerHalf) {
                    // Bottom half: reverse order so pass 0 is at bottom
                    const index = tubesPerHalf - 1 - pass;
                    const startY = shellY + shellHeight / 2 + 12 + 20; // Start below gap
                    return startY + (index + 1) * spacing - tubeHeight / 2;
                } else {
                    // Top half: pass 2 is bottom of top half, pass 3 is top
                    const index = passes - 1 - pass;
                    const startY = shellY + 20;
                    return startY + (index + 1) * spacing - tubeHeight / 2;
                }
            } else {
                const totalTubeArea = shellHeight - 40;
                const spacing = totalTubeArea / (passes + 1);
                const reverseIndex = passes - 1 - pass;
                return shellY + 20 + (reverseIndex + 1) * spacing - tubeHeight / 2;
            }
        };
        
        const isOnePassCounter = passes === 1 && this.config.tube.flowArrangement === 'counter';
        
        const tubeSegments = [];
        let totalTubeLength = 0;
        
        for (let pass = 0; pass < passes; pass++) {
            const ty = getTy(pass);
            
            let isReverse = pass % 2 !== 0; 
            
            // If 1-pass and counter-flow, tube visually flows R-to-L
            if (isOnePassCounter) {
                isReverse = true;
            }
            
            let passProfile = this.result.profile.map(p => p.tubePasses[pass]);
            
            let startX = shellPadding - 10;
            let endX = shellPadding + shellWidth - 30; // Always inside the right wall
            
            const isLeftCrossover = this.config.shell.passes === 2 && (passes / 2) % 2 === 0;
            const isGapBend = (p) => isLeftCrossover && p === passes / 2 - 1;
            const comesFromGap = (p) => isLeftCrossover && p === passes / 2;
            
            if (pass !== 0 && pass !== passes - 1 && !isGapBend(pass) && !comesFromGap(pass)) {
                // Internal U-bends stay inside the left wall
                startX = shellPadding + 30;
            }
            
            // If passes is odd, the last tube punches through the right wall
            if (passes % 2 !== 0 && pass === passes - 1) {
                endX = shellPadding + shellWidth + 10;
            }
            
            const tubeW = endX - startX;
            
            this.drawSegmentedBody(
                startX, ty, tubeW, tubeHeight,
                passProfile, minT, maxT
            );
            
            // Record segment for continuous particles
            tubeSegments.push({
                type: 'straight', pass, startX, endX, isReverse, length: tubeW, accumulatedLength: totalTubeLength
            });
            totalTubeLength += tubeW;
            
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 2;
            // Only draw top and bottom lines of the straight tube so bends look seamless
            this.ctx.beginPath();
            this.ctx.moveTo(startX, ty);
            this.ctx.lineTo(startX + tubeW, ty);
            this.ctx.moveTo(startX, ty + tubeHeight);
            this.ctx.lineTo(startX + tubeW, ty + tubeHeight);
            this.ctx.stroke();
            
            // Draw protruding inlet/outlet pipes
            if (pass === 0) { // Inlet
                const inletRight = isOnePassCounter;
                if (inletRight) {
                    const inX = shellPadding + shellWidth + 10;
                    this.ctx.fillStyle = this.getColorForTemp(this.config.coldFluid.tempIn, minT, maxT);
                    this.ctx.fillRect(inX, ty, 50, tubeHeight);
                    this.ctx.strokeRect(inX, ty, 50, tubeHeight);
                    
                    this.ctx.fillStyle = textColor;
                    this.ctx.font = '12px Inter, sans-serif';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText('Tube In', inX + 60, ty + tubeHeight / 2 + 4);
                } else {
                    this.ctx.fillStyle = this.getColorForTemp(this.config.coldFluid.tempIn, minT, maxT);
                    this.ctx.fillRect(shellPadding - 60, ty, 50, tubeHeight);
                    this.ctx.strokeRect(shellPadding - 60, ty, 50, tubeHeight);
                    
                    this.ctx.fillStyle = textColor;
                    this.ctx.font = '12px Inter, sans-serif';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText('Tube In', shellPadding - 70, ty + tubeHeight / 2 + 4);
                }
            }
            if (pass === passes - 1) { // Outlet
                const isOutletRight = (passes % 2 !== 0) && !isOnePassCounter;
                
                if (isOutletRight) {
                    const outX = shellPadding + shellWidth + 10;
                    this.ctx.fillStyle = this.getColorForTemp(this.result.coldTempOut, minT, maxT);
                    this.ctx.fillRect(outX, ty, 50, tubeHeight);
                    this.ctx.strokeRect(outX, ty, 50, tubeHeight);
                    
                    this.ctx.fillStyle = textColor;
                    this.ctx.font = '12px Inter, sans-serif';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText('Tube Out', outX + 60, ty + tubeHeight / 2 + 4);
                } else {
                    this.ctx.fillStyle = this.getColorForTemp(this.result.coldTempOut, minT, maxT);
                    this.ctx.fillRect(shellPadding - 60, ty, 50, tubeHeight);
                    this.ctx.strokeRect(shellPadding - 60, ty, 50, tubeHeight);
                    
                    this.ctx.fillStyle = textColor;
                    this.ctx.font = '12px Inter, sans-serif';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText('Tube Out', shellPadding - 70, ty + tubeHeight / 2 + 4);
                }
            }
            
            // Draw U-Bends connecting to the NEXT pass
            if (pass < passes - 1) {
                const nextTy = getTy(pass + 1); 
                const cy = (ty + nextTy) / 2 + tubeHeight / 2;
                const radius = Math.abs(ty - nextTy) / 2;
                
                let cx, startAngle, endAngle, counterclockwise;
                
                // Color at the bend
                const bendColor = isReverse 
                    ? this.getColorForTemp(passProfile[0], minT, maxT) // left edge
                    : this.getColorForTemp(passProfile[passProfile.length - 1], minT, maxT); // right edge
                
                if (!isReverse) {
                    // Flows L-to-R, U-bend is on the right
                    cx = endX;
                    startAngle = -Math.PI / 2; // top
                    endAngle = Math.PI / 2; // bottom
                    counterclockwise = false;
                } else {
                    // Flows R-to-L, U-bend is on the left
                    if (isGapBend(pass)) {
                        cx = shellPadding - 10; // Crosses the physical gap
                    } else {
                        cx = shellPadding + 30; // Internal left U-bend
                    }
                    startAngle = Math.PI / 2; // bottom
                    endAngle = 3 * Math.PI / 2; // top
                    counterclockwise = false;
                }
                
                const arcLen = Math.max(10, Math.PI * radius);
                tubeSegments.push({
                    type: 'bend', cx, cy, radius, startAngle, endAngle, isReverse, length: arcLen, accumulatedLength: totalTubeLength
                });
                totalTubeLength += arcLen;
                
                // Draw inner fluid first
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, Math.max(0, radius), startAngle, endAngle, counterclockwise);
                this.ctx.strokeStyle = bendColor;
                this.ctx.lineWidth = tubeHeight;
                this.ctx.stroke();
                
                // Draw inner and outer borders AFTER fluid to match straight tube borders exactly
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = 2;
                
                // Outer border
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, Math.max(0, radius + tubeHeight / 2), startAngle, endAngle, counterclockwise);
                this.ctx.stroke();
                
                // Inner border
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, Math.max(0, radius - tubeHeight / 2), startAngle, endAngle, counterclockwise);
                this.ctx.stroke();
            }
        }
        
        // Draw continuous tube particles
        if (this.particles && totalTubeLength > 0) {
            const speed = Math.max(10, this.config.coldFluid.massFlow * 5);
            this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
            
            for (let p of this.particles) {
                const actualSpeed = speed * p.speedOffset * dt;
                
                // Advance particle along continuous 1D path
                if (p.distanceRatio === undefined) p.distanceRatio = Math.random();
                p.distanceRatio += actualSpeed / totalTubeLength;
                if (p.distanceRatio > 1) {
                    p.distanceRatio = 0;
                    p.radiusOffset = Math.random();
                }
                
                const currentDist = p.distanceRatio * totalTubeLength;
                
                // Binary/linear search for current segment
                let currentSeg = tubeSegments[0];
                for (let i = tubeSegments.length - 1; i >= 0; i--) {
                    if (currentDist >= tubeSegments[i].accumulatedLength) {
                        currentSeg = tubeSegments[i];
                        break;
                    }
                }
                
                if (!currentSeg) continue;
                
                const localDist = currentDist - currentSeg.accumulatedLength;
                const progress = currentSeg.length > 0 ? localDist / currentSeg.length : 0;
                
                let px, py;
                if (p.radiusOffset === undefined) p.radiusOffset = Math.random();
                
                // U-bends geometrically invert the vertical position of the fluid stream relative to the tube bounds.
                // An inner radius of a U-bend connects the top of the bottom tube to the bottom of the top tube.
                // We mathematically invert the offset every odd pass to seamlessly track this inversion.
                const effectiveOffset = (currentSeg.pass % 2 === 0) ? p.radiusOffset : (1 - p.radiusOffset);
                
                if (currentSeg.type === 'straight') {
                    const ty = getTy(currentSeg.pass);
                    if (!currentSeg.isReverse) {
                        px = currentSeg.startX + progress * currentSeg.length;
                    } else {
                        px = currentSeg.endX - progress * currentSeg.length;
                    }
                    py = ty + effectiveOffset * tubeHeight;
                } else {
                    let currentAngle;
                    if (!currentSeg.isReverse) {
                        currentAngle = Math.PI / 2 - Math.PI * progress; // Right bend: Bottom to Top
                    } else {
                        currentAngle = Math.PI / 2 + Math.PI * progress; // Left bend: Bottom to Top
                    }
                    const pRadius = currentSeg.radius - tubeHeight / 2 + effectiveOffset * tubeHeight;
                    px = currentSeg.cx + pRadius * Math.cos(currentAngle);
                    py = currentSeg.cy + pRadius * Math.sin(currentAngle);
                }
                
                this.ctx.beginPath();
                this.ctx.arc(px, py, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Render Loop
        this.animationId = requestAnimationFrame(this.draw);
    }
}
