export const getPolygonPathD = (
    width: number,
    height: number,
    pointCount: number,
    innerRadiusRatio: number,
    cornerRadius: number
  ): string => {
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
  
    const points = [];
    const angleStep = (Math.PI * 2) / (pointCount * 2);
  
    for (let i = 0; i < pointCount * 2; i++) {
      const radius = i % 2 === 0 ? 1 : innerRadiusRatio;
      const angle = i * angleStep - Math.PI / 2;
      points.push({
        x: cx + rx * radius * Math.cos(angle),
        y: cy + ry * radius * Math.sin(angle),
      });
    }
    
    if (cornerRadius <= 0) {
      return "M" + points.map(p => `${p.x} ${p.y}`).join("L") + "Z";
    }

    const path = [];
    for (let i = 0; i < points.length; i++) {
        const p0 = points[(i - 1 + points.length) % points.length];
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        const v1x = p0.x - p1.x;
        const v1y = p0.y - p1.y;
        const v2x = p2.x - p1.x;
        const v2y = p2.y - p1.y;

        const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
        
        const maxRadius = Math.min(len1, len2) / 2.2;
        const clampedRadius = Math.min(cornerRadius, maxRadius);

        const pt1 = {
            x: p1.x + (v1x / len1) * clampedRadius,
            y: p1.y + (v1y / len1) * clampedRadius
        };
        const pt2 = {
            x: p1.x + (v2x / len2) * clampedRadius,
            y: p1.y + (v2y / len2) * clampedRadius
        };

        if (i === 0) {
            path.push(`M ${pt1.x} ${pt1.y}`);
        } else {
            path.push(`L ${pt1.x} ${pt1.y}`);
        }
        path.push(`Q ${p1.x} ${p1.y} ${pt2.x} ${pt2.y}`);
    }
    path.push("Z");
    return path.join(" ");
  };