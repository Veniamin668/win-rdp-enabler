# Win RDP Enabler 🚀

A GitHub Action to instantly set up RDP and network connectivity via Tailscale on Windows GitHub Actions runners.

## Usage

Add this step to your Windows job workflow:

```yaml
     	- name: Run Win RDP Enabler
        uses: Veniamin668/win-rdp-enabler@x64-js # or arm-js
        with:
         tail-key: ${{ secrets.TAIL_KEY }}
         admin-pass: ${{ secrets.ADMIN_PASS }}
         use-custom-user: 'false'
         custom-username: ''
         custom-password: ${{ secrets.CUSTOM_PASSWORD }}
         hostname: 'your-name-vm'
```
### Available versions

* `arm-js` — Windows ARM64 runners
* `x64-js` — Windows x64 runners

Required Secrets
Go to your repository Settings -> Secrets and variables -> Actions and add:

`TAIL_KEY` — Your Tailscale Auth Key (required)

`ADMIN_PASS` — Password for runneradmin (optional)

`CUSTOM_PASSWORD` — Password for your custom user if use-custom-user is enabled (optional)

`HOSTNAME` — Name runner , you can use any name for the runner. (optional)

### 👤 Custom User Options

- If `use-custom-user` is set to **`false`**, the action will use the default `runneradmin` account (and update its password if `ADMIN_PASS` is provided).
- If you want to create your own local admin, set `use-custom-user` to **`true`**, specify your desired name in `username`, and provide a password via `CUSTOM_PASSWORD`.
