import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "fs";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
  };
}
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "public", "modeller", "3D", "bed.glb");

const bed = new THREE.Group();
bed.name = "bed";

const wood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
const mattress = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.9 });
const blanket = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.95 });
const pillowMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.8 });

const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 1.85), wood);
frame.position.set(0, 0.11, 0);
bed.add(frame);

const mattressMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.18, 1.75), mattress);
mattressMesh.position.set(0, 0.31, 0.02);
bed.add(mattressMesh);

const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.2), blanket);
duvet.position.set(0, 0.44, 0.25);
bed.add(duvet);

const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 0.1), wood);
headboard.position.set(0, 0.52, -0.88);
bed.add(headboard);

const pillowGeo = new THREE.BoxGeometry(0.48, 0.14, 0.32);
const pillowL = new THREE.Mesh(pillowGeo, pillowMat);
pillowL.position.set(-0.42, 0.48, -0.58);
bed.add(pillowL);

const pillowR = new THREE.Mesh(pillowGeo, pillowMat);
pillowR.position.set(0.42, 0.48, -0.58);
bed.add(pillowR);

const legGeo = new THREE.BoxGeometry(0.12, 0.11, 0.12);
const legOffsets = [
  [-0.9, 0.055, -0.82],
  [0.9, 0.055, -0.82],
  [-0.9, 0.055, 0.82],
  [0.9, 0.055, 0.82],
];
for (const [x, y, z] of legOffsets) {
  const leg = new THREE.Mesh(legGeo, wood);
  leg.position.set(x, y, z);
  bed.add(leg);
}

async function main() {
  await new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      bed,
      (result) => {
        fs.writeFileSync(outPath, Buffer.from(result));
        console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
        resolve();
      },
      reject,
      { binary: true }
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
