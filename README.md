# Monster Hunt (Sky Strike)

A 3D arcade game built with [Three.js](https://threejs.org/). A monster is wrecking the city. Drive your armored truck through the streets, hunt it down, and knock it out three times before the city (or your truck) goes down.

## How to play

- **Joystick (bottom-left):** push it the way you want to drive. Pull it back to brake and reverse.
- **FIRE:** hold to shoot straight out of the turret.
- **🚀 Missile:** a big explosive shot. Recharges every 5 seconds.
- **🔥 NITRO:** a speed boost. The meter refills on its own.
- **📢 Horn:** scares the monster for a moment.
- **Keyboard:** WASD / arrow keys to drive, Space to fire, E for the missile, Shift for nitro, H to honk.

The monster has 3 phases. In phase 1 it fights you head-on, in phase 2 it hides and you have to find it (follow the compass, its roars, and the dust clouds), and in phase 3 it's angry. Save as much of the city as you can for up to 3 stars.

## Project structure

- `index.html` / `www/index.html`: the game itself (one self-contained HTML file)
- `android/`: the Capacitor-generated Android project
- `.github/workflows/build-apk.yml`: builds a debug APK and publishes a GitHub Release on every push to `main`

## Getting the APK

Every push to `main` builds a fresh debug APK automatically:

- **Easiest (Releases):** open the [Releases page](https://github.com/talibmohd0099/monster_hunt/releases), open the latest one, and download `monster-hunt.apk`.
- **Alternative (Actions artifact):** open the **Actions** tab, click the latest successful **Build APK** run, and download the `monster-hunt-debug-apk` artifact (comes zipped) from the bottom of the page.

Copy the APK to an Android phone and install it. You'll need to allow installs from unknown sources.

The game loads Three.js and its font from the internet, so the phone needs a connection the first time it runs.

### Building locally

```bash
npm install
cp index.html www/index.html
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Editing the game

All game code lives in `index.html`. The GitHub Actions workflow copies it into `www/index.html` before building, so you only need to edit `index.html`.
