# Win RDP Enabler 🚀

A GitHub Action to instantly set up RDP and network connectivity via Tailscale on Windows GitHub Actions runners.

## Usage

Add this step to your Windows job workflow:

```yaml
- name: Enable RDP & Tailscale
  uses: Veniamin668/win-rdp-enabler@main
  with:
    tailscale-authkey: ${{ secrets.TAIL_KEY }}
    admin-password: ${{ secrets.ADMIN_PASS }}
    use-custom-user: 'false'
    username: ''
    custom-password: ${{ secrets.CUSTOM_PASSWORD }}
```
Required Secrets
Go to your repository Settings -> Secrets and variables -> Actions and add:

`TAIL_KEY` — Your Tailscale Auth Key (required)

`ADMIN_PASS` — Password for runneradmin (optional)

`CUSTOM_PASSWORD` — Password for your custom user if use-custom-user is enabled (optional)

### 👤 Custom User Options

- If `use-custom-user` is set to **`false`**, the action will use the default `runneradmin` account (and update its password if `ADMIN_PASS` is provided).
- If you want to create your own local admin, set `use-custom-user` to **`true`**, specify your desired name in `username`, and provide a password via `CUSTOM_PASSWORD`.
