export class Collision {
    static check(bike, hazards) {
        if (!bike.boundingBox) return null;
        
        for (const hazard of hazards) {
            if (!hazard.boundingBox || (hazard.mesh && !hazard.mesh.visible)) continue;
            if (hazard.type === 'speedbump' && hazard.hitPassed) continue;
            
            if (bike.boundingBox.intersectsBox(hazard.boundingBox)) {
                return hazard; // return the hazard we hit
            }
        }
        
        return null;
    }

    // specific check for passing the jeep (distance based or z-crossing)
    static checkJeepPass(bike, hazards) {
        for (const hazard of hazards) {
            if (hazard.type === 'jeep') {
                // Check if bike just passed the jeep's Z position
                // We add a flag to the jeep to ensure we only check once
                if (!hazard.passed && bike.position.z < hazard.mesh.position.z) {
                    hazard.passed = true;
                    return hazard;
                }
            }
        }
        return null;
    }
}
