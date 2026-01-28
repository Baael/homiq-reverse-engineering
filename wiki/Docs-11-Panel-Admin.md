# 11 — Panel admina (admin2 + Zend “system”) + backup z UI

## Dwa panele administracyjne

- **`admin2`**: klasyczny CRUD (PHP)
  - logowanie: `/admin2/login.php`
  - użytkownicy: tabela `hwebadminUsers`
- **Zend “system”**: panel akcji/logów (w module `system`)
  - wejście zwykle: `/<baseUrl>/system`
  - użytkownicy: `membership_users` (`passMD5`, `isApproved`, `isBanned`)

## Konfiguracja aplikacji Zend

W produkcji konfiguracja bywa czytana z:

- `/homiq/etc/www/config.ini`

## Backup z UI (“GEN BACKUP”)

W wielu instalacjach backup jest robiony z poziomu panelu przez kolejkę:

- UI wrzuca zadanie do kolejki (Beanstalk)
- daemon odpala `bin/hbackup`
- UI streamuje logi i na końcu udostępnia archiwum do pobrania

## Bezpieczeństwo (ważne)

W źródłach mogą występować **twardo wpisane hasła** (DB/VoIP itd.). W dokumentacji źródłowej są wskazane lokalizacje do audytu/rotacji.

