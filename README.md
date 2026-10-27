# Mémo insuline

Mémo personnel pour personnes diabétiques : photo du repas, glycémie avant le repas, ce qui a été mangé et bu, unités d'insuline injectées. La fois suivante, l'application rappelle ce qui avait été fait pour le même repas.

- **Aucun calcul de dose** : c'est un carnet, le patient décide de sa dose.
- **100 % local** : les données et les photos restent sur le téléphone. La reconnaissance des plats (MobileCLIP, via Transformers.js) tourne sur l'appareil.
- **Hors ligne** : application web installable (PWA) sur Android.

## Contenu

- `carnet-pwa/` — l'application (à publier telle quelle)
- `carnet-insuline.html` — première maquette web

## Installer sur Android

1. Ouvrir l'application dans Chrome : https://thomasabraham84-design.github.io/App_Noco/carnet-pwa/
2. Menu ⋮ → « Installer l'application ».

## Tester sur PC

```bash
python -m http.server 8766 --directory carnet-pwa
```

Puis ouvrir http://localhost:8766.

Après chaque modification des fichiers, augmenter `VERSION` dans `carnet-pwa/sw.js` pour que les téléphones récupèrent la nouvelle version.
