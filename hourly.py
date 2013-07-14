#!/usr/bin/env python

import logging
import os
import os.path
import time
import datetime
import uuid
import subprocess
import json
import calendar
import shutil
import traceback

def latest_dataset(directory):
    choices = os.listdir(directory)
    for choice in sorted(choices, reverse=True):  # reverse alphabetical will give newest first
        try:
            when = time.strptime(choice, "%Y%m%d%H")
        except ValueError:
            pass
        else:
            return os.path.join(directory, choice), calendar.timegm(when)
    else:
        raise ValueError("No datasets!")

def last_line_of(filename):
    file = open(filename, 'r')
    last_line = ''
    for line in file:
        last_line = line
    return last_line.strip()

def run_prediction(prediction_time, predictions_dir, scenario_template,
                   dataset_filename, dataset_time, root):
    pred_binary = os.path.join(root, "pred_src", "pred")

    # Create a UUID for the prediction
    pred_uuid = uuid.uuid4()

    # Create a directory for the predicition result.
    pred_root = os.path.join(predictions_dir, str(pred_uuid))
    os.mkdir(pred_root)

    scenario = scenario_template.copy()
    scenario['launch-time'] = {
            'year': prediction_time.year,
            'month': prediction_time.month,
            'day': prediction_time.day,
            'hour': prediction_time.hour,
            'minute': prediction_time.minute,
            'second': prediction_time.second,
        }

    logging.debug('Using scenario:')
    logging.debug(scenario)

    # Convert the scenario to an INI
    scenarioINI = []
    for cattitle, catcontents in scenario.iteritems():
        scenarioINI.append('[%s]' % cattitle)
        for key, value in catcontents.iteritems():
            scenarioINI.append('%s = %s' % (key, value))
    scenarioINI = '\n'.join(scenarioINI)

    logging.debug('Scenario INI:')
    logging.debug(scenarioINI)

    # Write scenario
    scenario_filename = os.path.join(pred_root, 'scenario.ini')
    scenario_file = open(scenario_filename, 'w')
    scenario_file.write(scenarioINI + '\n')
    scenario_file.close()

    scenario_json_filename = os.path.join(pred_root, 'scenario.json')
    scenario_json_file = open(scenario_json_filename, 'w')
    json.dump(scenario, scenario_json_file)
    scenario_json_file.close()

    logging.debug('Launching prediction application...')

    # Try to wire everything up
    output_filename = os.path.join(pred_root, 'output.csv')
    output_file = open(output_filename, 'w')
    logging_filename = os.path.join(pred_root, 'log.txt')
    logging_file = open(logging_filename, 'w')
    pred_process = subprocess.Popen( \
        (pred_binary, '-v', '-i' + dataset_filename, '-s' + str(dataset_time),
            scenario_filename),
        stdout=output_file, stderr=logging_file)
    pred_process.wait()
    if pred_process.returncode:
        raise RuntimeError('Prediction process %s returned error code: %s.' % (pred_uuid, pred_process.returncode))
    output_file.close()
    logging_file.close()

    # Find the last line of the output
    last_output = last_line_of(output_filename)
    logging.debug('Final line of output: %s', last_output)

    (final_timestamp, latitude, longitude, alt) = map(lambda x: float(x), last_output.split(','))
    final_timestamp = int(final_timestamp)

    logging.debug('Parsed as ts=%s, lat=%s, lon=%s, alt=%s',
                  final_timestamp, latitude, longitude, alt)
    final_time = datetime.datetime.utcfromtimestamp(final_timestamp)

    manifest_entry = {
        'landing-location': {
            'latitude': latitude,
            'longitude': longitude,
            'altitude': alt,
        },
        'landing-time': {
            'year': final_time.year,
            'month': final_time.month,
            'day': final_time.day,
            'hour': final_time.hour,
            'minute': final_time.minute,
            'second': final_time.second,
        },
        'launch-time': {
            'year': prediction_time.year,
            'month': prediction_time.month,
            'day': prediction_time.day,
            'hour': prediction_time.hour,
            'minute': prediction_time.minute,
            'second': prediction_time.second,
        },
    }

    return (str(pred_uuid), manifest_entry)

def main(root):
    datasets = os.path.join(root, "tawhiri", "datasets")
    scenarios = os.path.join(root, "hourly", "scenarios")

    dataset_filename, dataset_time = latest_dataset(datasets)
    logging.info("using dataset %s", dataset_filename)

    for filename in os.listdir(scenarios):
        if not filename.endswith(".json"):
            continue
        name = filename[:-5]
        if name in ('', 'scenarios', 'lib') or '.' in name:
            continue
        logging.info("Running scenario %s", name)
        with open(os.path.join(scenarios, filename)) as f:
            scenario_template = json.load(f)
        scenario_data_directory = os.path.join(root, "hourly", name)
        run_scenario(scenario_template, scenario_data_directory,
                     dataset_filename, dataset_time, root)

def run_scenario(scenario_template, pred_root, dataset_filename, dataset_time, root):
    if os.path.isdir(pred_root):
        shutil.rmtree(pred_root)

    os.mkdir(pred_root)
    os.symlink("../lib/index.html", os.path.join(pred_root, "index.html"))
    with open(os.path.join(pred_root, ".gitignore"), "w") as f:
        f.write("*")

    # Where do we store the manifest file?
    manifest_filename = os.path.join(pred_root, 'manifest.json')
    manifest = {}

    manifest['scenario-template'] = scenario_template
    manifest['model'] = os.path.basename(dataset_filename)
    manifest['predictions'] = { }

    dataset_datetime = datetime.datetime.utcfromtimestamp(dataset_time)

    for i in range(24 * 7):
        predict_time = dataset_datetime + datetime.timedelta(hours=i)
        logging.info('Running prediction %s (%s)', i, predict_time)

        try:
            (uuid, entry) = run_prediction(predict_time, pred_root, scenario_template,
                                           dataset_filename, dataset_time, root)
        except:
            logging.exception("prediction failed")
        else:
            # Record in manifest
            manifest['predictions'][uuid] = entry
            logging.debug('ok')

    with open(manifest_filename, 'w') as f:
        json.dump(manifest, f)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    root = os.path.dirname(os.path.abspath(__file__))
    main(root)

# vim:sw=4:ts=4:et:autoindent
