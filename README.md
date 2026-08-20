# pi-raw-mode

Toggle Pi's assistant transcript between rendered Markdown and flush-left raw Markdown.

`pi-raw-mode` is a display-only extension for the [Pi coding agent](https://pi.dev). Raw mode preserves the assistant's Markdown source, removes Pi's assistant-message styling and structural padding, and makes terminal selection less noisy.

````text
# Literal heading

**Literal emphasis** and `literal code`

```ts
const answer = 42;
```
````

## Demo

https://github.com/user-attachments/assets/27428d08-38f2-46e1-b250-200232dd2d82

## Install

From npm:

```bash
pi install npm:pi-raw-mode
```

From GitHub:

```bash
pi install git:github.com/fanzeyi/pi-raw-mode
```

Try a checkout without installing it:

```bash
pi -e /absolute/path/to/pi-raw-mode
```

Run `/reload` after installing into an active Pi session.

## Usage

| Control | Effect |
| --- | --- |
| `/raw` | Toggle raw mode and show a confirmation |
| `/raw on` | Enable raw mode |
| `/raw off` | Disable raw mode |
| `Alt+R` | Toggle silently (default shortcut) |
| `PI_RAW_MODE=on pi` | Start Pi with raw mode enabled |

A `raw` footer indicator is visible while the mode is enabled.

### Configure the shortcut

Create `~/.pi/agent/pi-raw-mode.json`:

```json
{
  "shortcut": "ctrl+shift+r"
}
```

Run `/reload` after changing the file. The value uses Pi's normal shortcut syntax, such as `ctrl+r`, `ctrl+shift+r`, `alt+r`, `super+r`, or `f8`. Set `"shortcut": null` to disable the keyboard shortcut while keeping `/raw` available.

The config follows `PI_CODING_AGENT_DIR` when that environment variable points Pi at a different agent directory. An invalid config produces a warning and falls back to `alt+r`.

## What raw mode changes

Raw mode affects normal assistant text in Pi's interactive TUI:

- renders Markdown markers literally instead of interpreting them;
- adds no colors, borders, gutters, or horizontal padding;
- removes Pi's leading assistant-message spacer;
- updates while the assistant is streaming;
- shows assistant text only, hiding thinking blocks while raw mode is enabled;
- leaves the stored session and model context unchanged;
- removes terminal escape and control sequences before display.

Tool calls, user messages, and custom extension messages keep their existing rendering. Model-authored spaces and newlines are preserved; tabs are expanded to three spaces to match Pi's TUI convention.

## Inspiration

This extension is directly inspired by [OpenAI Codex CLI's `/raw` mode](https://developers.openai.com/codex/cli/slash-commands#toggle-raw-scrollback-with-raw), which was introduced to make terminal selection and copying more direct. Codex's implementation is described in [openai/codex#20819](https://github.com/openai/codex/pull/20819).

`pi-raw-mode` is an independent implementation for Pi and is not affiliated with or endorsed by OpenAI.

## Pi limitation

Codex owns and can rebuild its scrollback, so its raw mode can leave wrapping entirely to the terminal. Pi's public TUI component contract requires every rendered row to fit the available width. This extension therefore wraps long logical lines at terminal-cell boundaries; a copied long line may contain a hard line break where Pi wrapped it.

Pi also does not currently expose a renderer hook for normal assistant messages. The extension installs a guarded patch around Pi's exported `AssistantMessageComponent` and restores each method it still owns on shutdown. Version 0.1.0 deliberately supports Pi 0.84.x only and disables itself with a warning on other Pi versions.

Other extensions that patch assistant rendering may affect load-order behavior. Raw mode delegates to the renderer that was active when this package loaded whenever raw mode is off.

## Copying whole responses

Pi already provides `Ctrl+X` to copy the last assistant message. Use that when you want the complete underlying response without selecting terminal text. Raw mode is intended for reviewing or selecting only part of a response.

## Development

Requirements: Node.js 22.19 or newer and Pi 0.84.x.

```bash
npm install
npm run check
npm pack --dry-run
pi -e "$(pwd)"
```

The package ships TypeScript source directly because Pi loads extensions through Jiti.

## Publishing checklist

```bash
npm run check
npm pack --dry-run
npm publish --dry-run --registry=https://registry.npmjs.org
npm publish --registry=https://registry.npmjs.org
```

Tag the same version after publishing:

```bash
git tag v0.1.0
git push origin main v0.1.0
```

## License

MIT
