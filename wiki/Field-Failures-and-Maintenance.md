# Awarie i utrzymanie systemu Homiq bez producenta

## Co zrobić od razu, gdy “Homiq przestał działać”?

**Priorytet: bezpieczeństwo i funkcje krytyczne.**

Natychmiast sprawdź:

- ogrzewanie (kocioł, pompa, zawory)
- wentylacja (rekuperator)
- pompy (cyrkulacja, studnia)
- bramy i drzwi
- czujniki zalania

Jeśli coś krytycznego “wariuje”: **przełącz na tryb ręczny/awaryjny na urządzeniu**, nie w Homiq.

Zanim coś zresetujesz:

1. zrób zdjęcia rozdzielni, modułów, oznaczeń przewodów i LED
2. zanotuj co świeci/miga

## Szybkie testy sieci

```bash
ping <MOXA_IP>
nc -zv <MOXA_IP> 4001
```

## Światła migają / przekaźniki cykają / rolety żyją własnym życiem

To **poważny objaw**:

- niestabilne zasilanie
- luźne zaciski
- przeciążenie linii
- uszkodzony zasilacz lub moduł

Jeśli nie ustępuje — wezwij elektryka.

## Ogrzewanie nie reaguje / działa odwrotnie

Jeśli nie masz 100% pewności jak Homiq wpływa na kocioł/pompę — **przejdź na tryb ręczny** na urządzeniu grzewczym i dopiero diagnozuj automatykę.

## Kiedy wezwać elektryka?

Natychmiast, jeśli:

- coś się przegrzewa lub pachnie spalenizną
- iskrzenie lub dym
- miganie/cykanie nie ustępuje po izolacji sekcji
- musisz otworzyć rozdzielnię i nie masz kwalifikacji

