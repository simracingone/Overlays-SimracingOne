## [3.2.1] - 2026-01-29

### 🇫🇷 Français
#### Corrigé
- **HUD Radio** : Le panneau des experts de l'équipe s'affiche désormais correctement à l'écran lorsqu'un message audio est diffusé.
- **Visibilité** : Correction d'un conflit entre l'état de visibilité par défaut (sauvegardé dans le localStorage) et le déclenchement dynamique des messages. Le module force maintenant son apparition lors de la prise de parole.
- **Synchronisation** : Amélioration de la fluidité entre l'API TTS et l'affichage visuel pour éviter que le texte ne disparaisse trop tôt.

---

### 🇺🇸 English
#### Fixed
- **Radio HUD**: The team expert panel now correctly displays on-screen whenever an audio message is broadcasted.
- **Visibility**: Fixed a conflict between the default visibility state (stored in localStorage) and dynamic message triggering. The module now forces itself to be visible during speech.
- **Synchronization**: Improved timing between the TTS API and the visual UI to ensure the text remains visible throughout the audio playback.