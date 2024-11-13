import {Color, ConeGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3} from "three";
import {pointInSphere} from "./pointInSphere.jsx";

let pos;
let vel;
let frc;

let preyPos = [];
let preyVel = [];
let nPrey = 0;

let quickVec1 = new Vector3;
let quickVec2 = new Vector3;

class Hunter {
    constructor() {
        this.DESIRED_SPEED = 0.25;  // restores this speed with time
        this.TAU_SPEED = 0.01;     // how quick to restore the desired speed

        this.CHASE_RADIUS = 0.5;   // sees prey within this radius
        this.HABITAT_RADIUS = 1;    // gets pushed back if outside of habitat

        this.CHASE_FACTOR = 0.99;
        this.HABITAT_FACTOR = 1;

        this.enable = true;

        pos = pointInSphere(0.5);
        vel = pointInSphere().normalize().multiplyScalar(this.DESIRED_SPEED);
        frc = new Vector3();

        // Set up graphics
        // Set up graphics with glowing red material
        this.cone = new ConeGeometry(0.04, 0.09, 4);
        this.color = new Color(0xff0000); // Set to a strong red color
        this.material = new MeshStandardMaterial({
            color: this.color,
            emissive: new Color(0xff0000),  // Emissive red to make it glow
            emissiveIntensity: 6,         // Increase intensity for more glow
            wireframe: true
        });
        this.mesh = new Mesh(this.cone, this.material);
        this.axis = new Vector3(0, 1, 0);

        this.mouseTarget = new Vector3();

    }

    setMousePosition(mousePos) {
        this.mouseTarget.copy(mousePos); // Set the target position to the mouse position
    }

    tick(delta){
        if (this.enable) {
            frc.set(0, 0, 0);
            // Calculate the direction towards the mouse target
            const targetDirection = new Vector3().subVectors(this.mouseTarget, pos).normalize();
            
            // Apply a force to steer towards the mouse position
            frc.addScaledVector(targetDirection, this.CHASE_FACTOR);

            // Additional forces (e.g., staying within habitat and restoring velocity)
            frc.addScaledVector(this.constrainToSphere(this.HABITAT_RADIUS), this.HABITAT_FACTOR);
            frc.addScaledVector(this.restoreVelocity(), delta / this.TAU_SPEED);

            // Update velocity and position
            vel.addScaledVector(frc, delta);
            pos.addScaledVector(vel, delta);

            // Update mesh position and orientation
            this.mesh.position.copy(pos);
            let colorShift = Math.min(8 * Math.sqrt(nPrey), 50);
            this.material.color.setHSL(0, 0, (40 + colorShift) / 100);
            quickVec1.copy(vel);
            this.mesh.quaternion.setFromUnitVectors(this.axis, quickVec1.normalize()); // Align cone with the velocity
        }
        this.mesh.visible = this.enable;
    }
    chase(){
        quickVec1.set(0, 0, 0);
        for (let p = 0; p < nPrey; p++) {
            quickVec2.fromArray(preyPos, p * 3);
            quickVec2.addScaledVector(pos, -1); // proportional to distance
            quickVec1.addScaledVector(quickVec2, 1/(quickVec2.lengthSq()+0.0025)); // force proportional to 1/distance, 0.01 prevents jerking
        }
        if (nPrey > 0){
            quickVec1.multiplyScalar(1 / Math.max(nPrey, 10));
        }
        quickVec1.clampLength(0, 3);
        return quickVec1;
    }
    givePrey(preyPos_, preyVel_){
        preyPos = preyPos_;
        preyVel = preyVel_;
        nPrey = preyPos.length/3;
    }

    constrainToSphere(radius = 1){
        quickVec1.set(0, 0, 0); // Constraining force
        let len = pos.lengthSq();
        if (len > radius*radius){
            quickVec1.addScaledVector(pos, radius-len);
        }
        return quickVec1;
    }
    restoreVelocity(){
        quickVec1.copy(vel);
        quickVec1.multiplyScalar((this.DESIRED_SPEED-quickVec1.length()));
        return quickVec1;
    }
    getPos(){
        return pos.clone();
    }
}

export { Hunter }