# CUSF Predictor - "Version 2.5; tawhiri juryrig"

Cambridge University Spaceflight landing predictor - a web-based tool for predicting the flight path and landing location of latex meteorological sounding balloons.

This is a "temporary" repository, a stepping stone on the way to completion of larger CUSpaceflight work to rewriting the predictor.
We're replacing bits one at a time, and since the tawhiri wind downloader is completed, this project glues the old web UI to it.

## Dependencies and Install

Unless you fancy changing the paths in various files, you probably want to clone this repository to `/var/www/predict`. If not, see

  - `predict/includes/config.inc.php` (also contains other useful configuration options)
  - `deploy/*`

You will need to get a copy of the tawhiri downloader

    $ git submodule update --init

A copy of supervisord (typically system wide)

    $ sudo apt-get install supervisor

And a virtualenv with some python dependencies

    $ virtualenv  venv
    $ pip install -r requirements.txt

The source for the predictor itself is in `pred_src/`.

    $ cd pred_src
    $ cmake .
    $ make

Setup the crontab to run prune-predictions-cronjob.sh daily (deletes predictions in predict/preds not accessed or modified in the last 7 days)

    $ sudo crontab -u www-data deploy/crontab-example # assuming installed to /var/www/predict, else you will need to edit it

See `deploy/permissions`, which contains a list of directories that will need to be writable by the user that PHP and the downloader will run as (`www-data`).

    $ chgrp www-data predict/preds hourly/scenarios hourly/web tawhiri/datasets
    $ chmod g+rwxs predict/preds hourly/scenarios hourly/web tawhiri/datasets

Finally, start the daemons

    $ cp deploy/*.supervisord.conf /etc/supervisor/conf.d
    $ sudo supervisorctl update

And setup your web server. See deploy/nginx-predict.conf; you will need to:

  - serve the predict folder and the hourly folder (somewhere)
  - enable PHP in predict, but not in predict/preds or hourly/
  - serve the hourly-editor wsgi app, and its static directory

## License

This work is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or any later version. This work is distributed in the hope that it will be useful, but without any warranty; without even the implied warranty of merchantability or fitness for a particular purpose.

## Credits & Acknowledgments

Credit as detailed in individual files, but notably:

* Rich Wareham - The new predictor and the hourly predictor system
* Fergus Noble, Ed Moore and many others
* Adam Greig - [http://www.randomskk.net](http://www.randomskk.net) - [random@randomskk.net](mailto:random@randomskk.net)
* Jon Sowman - [http://www.hexoc.com](http://www.hexoc.com) - [jon@hexoc.com](mailto:jon@hexoc.com)
* Daniel Richman - [http://www.danielrichman.co.uk](http://www.danielrichman.co.uk) - [main@danielrichman.co.uk](mailto:main@danielrichman.co.uk)

Copyright Cambridge University Spaceflight 2009-2013 - All Rights Reserved
