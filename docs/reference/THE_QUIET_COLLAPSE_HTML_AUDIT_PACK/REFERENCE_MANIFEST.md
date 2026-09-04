# Reference Manifest and Usage Notes

These screenshots are third-party copyrighted reference material for private design study. Do not redistribute them as game assets, include them in a public repository, or ship them in a production bundle. Recreate principles with original THE QUIET COLLAPSE UI, art, wording, icons, and layouts.

## Resident Evil 2 (2019) reference set

Files `01` through `20` were curated from the [Resident Evil 2 collection at Interface In Game](https://interfaceingame.com/games/resident-evil-2/). The collection is used because it places major UI states in one consistent visual index. `21_game_over_flow.jpeg` is from [Kinga Olszewska's UI comparison article](https://medium.com/@kinga.olszewska/21-years-of-difference-in-designing-game-ui-based-on-resident-evil-2-1998-vs-2019-d2f8201c92de).

| File | Screen/function | Study | Do not copy |
| --- | --- | --- | --- |
| `01_main_menu.png` | Main menu | Hierarchy, background staging, contextual footer | Title treatment, exact layout, wording |
| `02_story_selection.png` | Continue/story flow | Nested choices and clear context | Story structure or imagery |
| `03_pause_menu.png` | Pause | Dimmed live context and fast resume | Exact columns, type, wording |
| `04_camera_settings.png` | Camera options | Dense option readability | Exact settings presentation |
| `05_objective_gameplay_prompt.png` | Gameplay/objective | Sparse HUD and temporary messaging | RPD scene, insignia, objective text |
| `06_context_interaction.png` | Focused interaction | Isolation of a diegetic task | Computer/scene design |
| `07_inventory_grid.png` | Inventory overview | Grid focus, health, description balance | Grid measurements and art |
| `08_inventory_actions.png` | Inventory action list | Context actions and selection clarity | Exact action menu/look |
| `09_item_inspection.png` | Item inspection | Object focus and restrained help | Item model and presentation |
| `10_item_use_context.png` | Use item | Confirm/cancel clarity | Door/key scene |
| `11_map_objectives.png` | Map | Map/objective separation and status color | Map geometry and iconography |
| `12_documents_notebook.png` | Documents | Distraction-free reading | Notebook art/content |
| `13_controller_settings.png` | Gamepad bindings | Visual mapping and discoverability | Controller art/glyph extraction |
| `14_keyboard_mouse_settings.png` | KBM bindings | Scan-friendly mapping | Exact wording/layout |
| `15_graphics_settings.png` | Graphics | Grouping and consequence visibility | Exact menu style |
| `16_screen_safe_area.png` | Screen calibration | Safe bounds | Exact calibration screen |
| `17_autosave_notice.png` | System notice | Concision and acknowledgement | Logo/spinner/text |
| `18_rewards_progress.png` | Unlock/reward | Clear confirmation | Reward names/layout |
| `19_misc_menu_overlay.png` | Detail/tabs | Layered information organization | Exact tabs/panels |
| `20_puzzle_input.png` | Contextual puzzle | Large readable task-specific controls | Puzzle design/model |
| `21_game_over_flow.jpeg` | Failure/recovery | Immediate continue/load/quit choices | Blood treatment, text, layout |

## Mobile touch reference set

| File | Source | Study | Do not copy |
| --- | --- | --- | --- |
| `01_cod_mobile_gameplay_hud.jpg` | [COD Mobile guide (Garena)](https://codm.garena.tw/guide) | Thumb zones, action clustering, HUD prioritization | Art, icons, exact placement |
| `02_pubg_mobile_gameplay_hud.png` | [Referenced community capture](https://www.answeroverflow.com/m/1129822137876750456?focus=1129822137876750456) | Tablet spacing and third-person touch layout | Art, branding, exact layout |
| `03_pubg_mobile_hud_customization.jpg` | [Globo Esporte PUBG Mobile guide](https://ge.globo.com/e-sportv/noticia/pubg-mobile-dicas-de-como-jogar-bem-e-ganhar-no-battle-royale.ghtml) | Drag/resize/opacity editor capability | UI styling and icons |
| `04_cod_mobile_advanced_controls.jpg` | [Bahamut community guide](https://forum.gamer.com.tw/C.php?bsn=36292&snA=155) | Simple/advanced control modes and custom layout entry | Art, labels, composition |

Primary product guidance also came from Activision's explanation that COD Mobile's custom layout supports drag, size, and opacity changes, and PUBG Mobile's support instructions for customizable control positions.

## Web input implementation references

- [MDN: Using the Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API)
- [W3C Gamepad specification](https://www.w3.org/TR/gamepad/)
- [MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN: `any-pointer`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/any-pointer)
- [MDN: `pointer`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/pointer)

Important limitation: the Gamepad API's `id` string is not strictly standardized. Controller-family recognition must be heuristic, expose confidence/fallback behavior, and always allow a manual glyph-family override.
