#!/usr/bin/env python

# Path to predictor binary
pred_binary = './pred_src/pred'

# Modules from the Python standard library.
import datetime
import time as timelib
import sys
import os
import os.path
import logging
import traceback
import calendar
import optparse
import subprocess
import statsd
import json

statsd.init_statsd({'STATSD_BUCKET_PREFIX': 'habhub.predictor'})

# Output logger format
log = logging.getLogger('main')
log_formatter = logging.Formatter('%(levelname)s: %(message)s')
console = logging.StreamHandler()
console.setFormatter(log_formatter)
log.addHandler(console)

progress_f = ''
progress = {
    'run_time': '',
    'dataset': '',
    'pred_running': False,
    'pred_complete': False,
    'warnings': False,
    'pred_output': [],
    'error': '',
}

def update_progress(**kwargs):
    global progress_f
    global progress
    for arg in kwargs:
        progress[arg] = kwargs[arg]
    try:
        progress_f.truncate(0)
        progress_f.seek(0)
        progress_f.write(json.dumps(progress))
        progress_f.flush()
        os.fsync(progress_f.fileno())
    except IOError:
        global log
        log.error('Could not update progress file')

@statsd.StatsdTimer.wrap('time')
def main():
    """
    The main program routine.
    """

    statsd.increment('run')

    # Set up our command line options
    parser = optparse.OptionParser()
    parser.add_option('-d', '--cd', dest='directory',
            help='change to, and run in, directory DIR',
            metavar='DIR')
    parser.add_option('-s', '--dataset-dir', dest='dataset_dir',
            help='dataset directory', metavar='DIR')
    parser.add_option('-x', '--dataset', dest='dataset',
            help='dataset', metavar='DATASET')
    parser.add_option('--fork', dest='fork', action="store_true",
            help='detach the process and run in the background')
    parser.add_option('--alarm', dest='alarm', action="store_true",
            help='setup an alarm for 10 minutes time to prevent hung processes')
    parser.add_option('--redirect', dest='redirect', default='/dev/null',
            help='if forking, file to send stdout/stderr to', metavar='FILE')
    parser.add_option('-v', '--verbose', action='count', dest='verbose',
        help='be verbose. The more times this is specified the more verbose.', default=False)
    parser.add_option('--preds', dest='preds_path',
            help='path that contains uuid folders for predictions [default: %default]',
            default='./predict/preds/', metavar='PATH')

    (options, args) = parser.parse_args()

    # Check we got a UUID in the arguments
    if len(args) != 1:
        log.error('Exactly one positional argument should be supplied (uuid).')
        statsd.increment('error')
        sys.exit(1)

    if bool(options.dataset) == bool(options.dataset_dir):
        log.error('Specify exactly one of dataset and dataset_dir')
        statsd.increment('error')
        sys.exit(1)

    if options.directory:
        os.chdir(options.directory)

    if options.fork:
        detach_process(options.redirect)

    if options.alarm:
        setup_alarm()

    uuid = args[0]
    uuid_path = options.preds_path + "/" + uuid + "/"

    # Check we're not already running with this UUID
    for line in os.popen('ps xa'):
        process = " ".join(line.split()[4:])
        if process.find(uuid) > 0:
            pid = int(line.split()[0])
            if pid != os.getpid():
                statsd.increment('duplicate')
                log.error('A process is already running for this UUID, quitting.')
                sys.exit(1)

    # Make the UUID directory if non existant
    if not os.path.exists(uuid_path):
        os.mkdir(uuid_path, 0770)

    # Open the progress.json file for writing, creating it
    global progress_f
    global progress
    try:
        progress_f = open(uuid_path+"progress.json", "w")
        update_progress(run_time=str(int(timelib.time())))
    except IOError:
        log.error('Error opening progress.json file')
        statsd.increment('error')
        sys.exit(1)
    
    # Check the predictor binary exists
    if not os.path.exists(pred_binary):
        log.error('Predictor binary does not exist.')
        statsd.increment('error')
        sys.exit(1)

    # How verbose are we being?
    if options.verbose > 0:
        log.setLevel(logging.INFO)
    if options.verbose > 1:
        log.setLevel(logging.DEBUG)
    if options.verbose > 2:
        logging.basicConfig(level=logging.INFO)
    if options.verbose > 3:
        logging.basicConfig(level=logging.DEBUG)

    if options.dataset:
        dataset_filename = options.dataset
        dataset_time = time_for_dataset_name(dataset_filename)
    elif options.dataset_dir:
        dataset_filename, dataset_time = latest_dataset(options.dataset_dir)

    if dataset_filename is None:
        log.error('No datasets in %s'.format(options.dataset_dir))
        statsd.increment('no_dataset')
        statsd.increment('error')
        sys.exit(1)

    statsd.increment('dataset.{0}'.format(os.path.basename(dataset_time)))
    log.info("Dataset: %s %s", dataset_filename, dataset_time)

    update_progress(gfs_complete=os.path.basename(dataset_time), pred_running=True)

    command = [pred_binary, '-i' + dataset_filename, '-s'+ str(dataset_time),
               '-v', '-o'+uuid_path+'flight_path.csv', uuid_path+'scenario.ini']
    if options.alarm:
        command.append("-a120")

    pred_process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    pred_output = []

    while True:
        line = pred_process.stdout.readline()
        if line == '':
            break

        # pass through
        sys.stdout.write(line)
        if ("WARN" in line or "ERROR" in line) and len(pred_output) < 10:
            pred_output.append(line.strip())

    exit_code = pred_process.wait()

    if exit_code == 1:
        # Hard error from the predictor. Tell the javascript it completed, so that it will show the trace,
        # but pop up a 'warnings' window with the error messages
        update_progress(pred_running=False, pred_complete=True, warnings=True, pred_output=pred_output)
        statsd.increment('success_serious_warnings')
    elif pred_output:
        # Soft error (altitude too low error, typically): pred_output being set forces the debug
        # window open with the messages in
        update_progress(pred_running=False, pred_complete=True, pred_output=pred_output)
        statsd.increment('success_minor_warnings')
    else:
        assert exit_code == 0
        update_progress(pred_running=False, pred_complete=True)
        statsd.increment('success')

def time_for_dataset_name(filename):
    return calendar.timegm(timelib.strptime(os.path.basename(filename), "%Y%m%d%H"))

def latest_dataset(directory):
    choices = os.listdir(directory)
    for choice in choices:
        try:
            when = timelib.strptime(choice, "%Y%m%d%H")
        except ValueError:
            pass
        else:
            return os.path.join(directory, choice), calendar.timegm(when)

def detach_process(redirect):
    # Fork
    if os.fork() > 0:
        os._exit(0)

    # Detach
    os.setsid()

    null_fd = os.open(os.devnull, os.O_RDONLY)
    out_fd = os.open(redirect, os.O_WRONLY | os.O_APPEND)

    os.dup2(null_fd, sys.stdin.fileno())
    for s in [sys.stdout, sys.stderr]:
        os.dup2(out_fd, s.fileno())

    # Fork
    if os.fork() > 0:
        os._exit(0)

def setup_alarm():
    # Prevent hung download:
    import signal
    signal.alarm(600)

# If this is being run from the interpreter, run the main function.
if __name__ == '__main__':
    try:
        main()
    except SystemExit as e:
        log.debug("Exit: " + repr(e))
        if e.code != 0 and progress_f:
            update_progress(error="Unknown error exit")
            statsd.increment("unknown_error_exit")
        raise
    except Exception as e:
        statsd.increment("uncaught_exception")
        log.exception("Uncaught exception")
        info = traceback.format_exc()
        if progress_f:
            update_progress(error="Unhandled exception: " + info)
        raise
