# Fish Pond

A living, top-down procedural pond with editable fish, water simulation, habitat decoration, feeding, depth, ecology, and multiple saved ponds.

## Run on this computer and phone

Install dependencies once:

```powershell
npm install
```

Start the local host:

```powershell
npm run host
```

On a phone connected to the same Wi-Fi, open the Network URL printed by Vite. The computer must remain awake and the host command must stay running.

For the production build:

```powershell
npm run build
npm run host:prod
```

Pond saves currently live in each browser's local storage, so the phone and desktop maintain separate pond libraries.
