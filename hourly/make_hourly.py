#!/usr/local/bin/python3

import sys
import os.path
import re
import json
import subprocess

DIR = "/var/www/predict/hourly/scenarios/"

config = {
    "altitude-model": {
        "ascent-rate": 5.0, 
        "burst-altitude": 30000, 
        "descent-rate": 5.0
    }
}

config["name"] = input("Name: ")

predname = re.sub("[^a-zA-Z0-9]", "", config["name"].lower())
basename = predname + ".json"
filename = os.path.join(DIR, basename)

if os.path.exists(filename):
    print(filename, "already exists", file=sys.stderr)
    sys.exit(1)


if sys.argv[1:] == ["--redacted"]:
    config["owner"] = {
        "email": "red@ct.ed",
        "name": "Redacted"
    }
    config["password"] = "redacted"
else:
    config["owner"] = {
        "email": input("Owner's email: "),
        "name": input("Owner's name: ")
    }
    config["password"] = input("Password: ")

config["launch-site"] = {
    "latitude": float(input("Latitude: ")),
    "longitude": float(input("Longitude: ")),
    "altitude": float(input("Altitude: "))
}

config_dumped = json.dumps(config, indent=4, sort_keys=True)

print(config_dumped)
while input("OK? [y] ").lower() not in {"y", "yes"}:
    pass

with open(filename, 'x') as f:
    f.write(config_dumped)

os.chmod(filename, 0o664)
subprocess.check_call(["sudo", "chown", "www-data:users", filename])

print("Done")
print(filename)
print("http://predict.habhub.org/hourly/{}/".format(predname))
print("http://predict.habhub.org/hourly/edit/{}".format(predname))
