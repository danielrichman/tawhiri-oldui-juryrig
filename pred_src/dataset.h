#include "tawhiri_axes.h"
#include <time.h>

#ifndef DATASET_H
#define DATASET_H

struct dataset
{
    time_t start_time;
    const dataset_array_t *array;
    int pressure_hint_hour_index;
    int pressure_hint_before;
    int pressure_hint_after;
};

int dataset_open(const char *filename, time_t start_time,
                 struct dataset *dataset);
int dataset_close(struct dataset *dataset);

int get_wind(struct dataset *d,
             double lat, double lon, double alt, long int timestamp,
             double *wind_v, double *wind_u);

#endif // DATSET_H
