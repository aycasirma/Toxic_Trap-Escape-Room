# Toxic Trap: Escape Room 🚪☣️

**Repository:** [github.com/aycasirma/Toxic_Trap-Escape-Room](https://github.com/aycasirma/Toxic_Trap-Escape-Room)

A 3D WebGL-based escape room simulation game developed for the **SENG 340 - Computer Games and Simulation** Final Project.

## 🎮 The Gameplay Loop
You wake up in a locked room. Your head hurts, and a deadly toxic gas begins to leak from the corner. You must act fast:
1. **Explore:** Use First-Person controls to inspect the room.
2. **Survive the Quake:** A violent earthquake hits the room when gas levels rise, altering the environment and revealing hidden areas.
3. **Solve the Puzzle:** Gather hidden digits around the room to crack the safe's passcode.
4. **Escape:** Unlock the heavy padlock on the door and evacuate before the gas concentration reaches 100%.

## 🤖 AI-Driven Development (Behind the Scenes)
This project was heavily accelerated using Generative AI workflows:
* **LLM Integration:** AI was utilized to orchestrate the core Game Loop, managing state transitions (Waking Up -> Searching -> Earthquake -> Escaping).
* **Physics & Mathematics:** The custom vector-based gas funneling (vacuum effect when the door opens) and camera shake algorithms were rapidly prototyped through AI prompting.
* **UI/UX:** The immersive dynamic crosshair, interactive Keypad UI, and cinematic subtitle system were generated and refined iteratively with AI assistance, reducing UI coding time by 80%.

## 🛠️ Technologies Used
* **Three.js:** Core 3D rendering and scene management.
* **Vite:** Next-generation frontend tooling for rapid development.
* **Web Audio API:** For real-time, zero-dependency synthesizer sound effects (Alarms, UI interactions).

## 🚀 How to Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/aycasirma/Toxic_Trap-Escape-Room.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🌐 Live Demo

**Play online:** [https://toxic-trap-escape-room.vercel.app](https://toxic-trap-escape-room.vercel.app)
