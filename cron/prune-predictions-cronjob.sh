#!/bin/bash

PARAM="mtime"
AGE="14"

REPOROOT="/var/www/predict/"
DATADIR="predict/preds"

echo `ls $REPOROOT$DATADIR/ | wc -l` "prediction scenarios found"
echo `find $REPOROOT$DATADIR/ -maxdepth 1 -type d -$PARAM +$AGE | wc -l` "of them had $PARAM of more than $AGE days"
echo "Now deleting..."
find $REPOROOT$DATADIR/ -maxdepth 1 -type d -$PARAM +$AGE -exec rm -rf {} \;
echo "Done deleting."
echo `ls $REPOROOT$DATADIR/ | wc -l` "prediction scenarios remaining"
