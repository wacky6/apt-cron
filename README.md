# apt-cron
Apartment Buzzer! Send email if found prospective rent properties.

## Usage
1. Tweak with params in `bin/apt-cron`, see `QUERY` and `WANTED_STREETS`
2. `docker build . -t apt-cron`
3. (crontab) `docker -e SENDGRID_API_KEY=<YOUR_KEY_HERE> -e apt-cron`
