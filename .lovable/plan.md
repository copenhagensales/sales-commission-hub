

# Plan: Synkroniser preview-kort med editor-indhold

## Problem
Preview-kortet i "Sider"-fanen viser tekst der **ikke matcher editoren**:

1. **Hardcoded demo-linje** i preview: "Oscar ringer dig tirsdag d. 22. april kl. 10:00. Samtalen er helt uforpligtende." — denne linje er ikke redigerbar og stammer ikke fra `body_lines`
2. **Fallback-titel** på den offentlige side er "Perfekt – du er booket! 🎉" mens editoren og preview bruger det gemte `page.title`
3. Preview viser indhold der ikke kan redigeres, hvilket giver falsk forventning om hvad kandidaten ser

## Løsning

### 1. Fjern hardcoded demo-linje fra preview (`BookingPagesTab.tsx`)
- Slet linje 192-194 (den faste "Oscar ringer dig tirsdag d. 22. april..."-tekst)
- Preview skal **kun** vise det der faktisk kan redigeres: titel, body_lines, tip_text
- Tilføj en lille note under preview: "Dato, tid og rekrutterernavn indsættes automatisk på kandidatsiden"

### 2. Synkroniser fallback-tekster (`PublicCandidateBooking.tsx`)
- Ændr titel-fallback fra "Perfekt – du er booket! 🎉" til "Din samtale er booket! 🎉" så det matcher preview
- Ændr tip-fallback til at matche preview

## Filer der ændres
- `src/components/recruitment/BookingPagesTab.tsx` — fjern hardcoded demo-tekst fra preview
- `src/pages/recruitment/PublicCandidateBooking.tsx` — synkroniser fallback-værdier

## Resultat
Preview-kortet viser præcis det editoren styrer. Kandidatsiden tilføjer dynamisk dato/tid automatisk, og det fremgår af en note.

