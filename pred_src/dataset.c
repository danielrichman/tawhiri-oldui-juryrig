#include "dataset.h"

#include <stdio.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <time.h>

#include <assert.h>

#include "tawhiri_axes.h"

static const int pressure_hint_fail = -16; // -1 <= hint <= length - 1
static const double tol = 1e-7;
static const double lambda_fail = -1;

// for passing and returning multiple values from a get_wind functions
// concisely
struct interp
{
    int lat_south;
    int lon_west, lon_east;
    double lat_lambda, lon_lambda;
};

struct level
{
    int pressure_index;
    double height_below, height_above;
};

struct interp3
{
    int hour_before;
    double hour_lambda;
    double height;
    struct level level_before, level_after;
    struct interp p;
};

// for fixed hour; lat, lon with interpolation
// find the level that contains height
static struct level height_search(struct dataset *d, int hour_index,
                                  int hour_which, double height,
                                  struct interp p);

// for fixed hour, pressure, variable
// interpolate over lat and lon
static double interp_variable(struct dataset *d, int hour_index, int pressure,
                              int variable, struct interp p);

// for fixed hour, variable
// interpolate over pressure, lat, lon
static double interp_variable2(struct dataset *d, int hour_index,
                               struct level level, double height,
                               int variable, struct interp p);

// for fixed variable interpolate over pressure, lat, lon
static double interp_variable3(struct dataset *d,
                               struct interp3 p3, int variable);

static double lambda(double left, double right, double value);
static double lambda_axes(const double *axes, int index, double value);
static double lerp(double left, double right, double lambda);

int dataset_open(const char *filename, time_t start_time,
                 struct dataset *dataset)
{
    int fd;
    struct stat stat;

    dataset->start_time = start_time;
    dataset->pressure_hint_hour_index = -1;
    dataset->pressure_hint_before = pressure_hint_fail;
    dataset->pressure_hint_after = pressure_hint_fail;

    fd = open(filename, O_RDONLY);
    if (fd == -1)
    {
        perror("ERROR: open");
        return -1;
    }

    if (fstat(fd, &stat) != 0)
    {
        perror("ERROR: stat");
        return -1;
    }

    if (stat.st_size != sizeof(dataset_array_t))
    {
        fprintf(stderr, "ERROR: dataset file is the wrong size");
        return -1;
    }

    dataset->array = 
        mmap(NULL, sizeof(dataset_array_t), PROT_READ, MAP_PRIVATE, fd, 0);
    if (dataset->array == MAP_FAILED)
    {
        perror("mmap");
        return -1;
    }

    return 0;
}

int dataset_close(struct dataset *dataset)
{
    return munmap(dataset->array, sizeof(dataset_array_t));
}

int get_wind(struct dataset *d,
             double lat, double lon, double alt, long int timestamp,
             double *wind_v, double *wind_u)
{
    struct interp p;
    struct interp3 p3;
    double hour;

    // use of lambda_axes serves to assert that the index calculations
    // are correct

    hour = (timestamp - d->start_time) / 3600;

    p3.hour_before = hour / 3;
    if (p3.hour_before < 0 || p3.hour_before >= shape[0] - 1)
        return 0;
    p3.hour_lambda = lambda(axis_0_hour[p3.hour_before],
                            axis_0_hour[p3.hour_before + 1],
                            hour);

    p.lat_south = (lat * 2) + 180;
    if (p.lat_south < 0 || p.lat_south >= shape[3] - 1)
        return 0;
    p.lat_lambda = lambda_axes(axis_3_latitude, p.lat_south, lat);

    if (359.5 < lon && lon < 360 + tol)
    {
        p.lon_west = shape[4] - 1;
        p.lon_east = 0;
        p.lon_lambda = lambda(axis_4_longitude[p.lon_west],
                              axis_4_longitude[p.lon_east] + 360,
                              lon);
    }
    else if (-tol < lon && lon < 0)
    {
        p.lon_west = 0;
        p.lon_east = 1;
        p.lon_lambda = lambda_axes(axis_4_longitude, p.lon_west, lon);
    }
    else
    {
        p.lon_west = lon * 2;
        p.lon_east = p.lon_west + 1;
        p.lon_lambda = lambda_axes(axis_4_longitude, p.lon_west, lon);
        if (p.lon_west < 0 || p.lon_west >= shape[4] - 1)
            return 0;
    }

    p3.level_before = height_search(d, p3.hour_before, 0, alt, p);
    p3.level_after = height_search(d, p3.hour_before, 1, alt, p);
    p3.height = alt;
    p3.p = p;

    *wind_u = interp_variable3(d, p3, 1);
    *wind_v = interp_variable3(d, p3, 2);
    return 1;
}

static struct level height_search(struct dataset *d, int hour_index,
                                  int hour_which, double height,
                                  struct interp p)
{
    int *hint;
    int length, below, above;
    double height_below, height_above;
    struct level level;

    // assume that the pressure layers don't cross
    // that is, the height d->array[.][n][0][.][.] is strictly increasing
    //  as n increases

    length = shape[1];

    if (d->pressure_hint_hour_index != hour_index)
    {
        d->pressure_hint_hour_index = hour_index;
        d->pressure_hint_before = pressure_hint_fail;
        d->pressure_hint_after = pressure_hint_fail;
    }

    if (hour_which)
    {
        hint = &d->pressure_hint_after;
        hour_index++;
    }
    else
    {
        hint = &d->pressure_hint_before;
    }

    if (*hint == -1)
    {
        // this hint says that the height is below the lowest pressure
        double lowest_height = interp_variable(d, hour_index, 0, 0, p);
        if (height < lowest_height)
        {
            // quick path - remained at same level
            level.height_below = level.height_above = lowest_height;
            level.pressure_index = -1;
            return level;
        }
        else
        {
            // move up one cell, then continue search as normal
            *hint = 0;
        }
    }

    if (*hint == length - 1)
    {
        // height above highest pressure; then as above
        double highest_height = 
            interp_variable(d, hour_index, length - 1, 0, p);
        if (height > highest_height)
        {
            // quick path - remained at same level
            level.height_below = level.height_above = highest_height;
            level.pressure_index = length - 1;
            return level;
        }
        else
        {
            *hint = length - 2;
        }
    }

    below = 0;
    above = length - 1;

    if (0 <= *hint && *hint <= length - 2)
    {
        double hint_height_below = interp_variable(d, hour_index, *hint, 0, p);
        double hint_height_above =
            interp_variable(d, hour_index, *hint + 1, 0, p);
        assert(hint_height_below < hint_height_above);

        if (hint_height_below <= height && height <= hint_height_above)
        {
            // quick path - remained at same level
            level.height_below = hint_height_below;
            level.height_above = hint_height_above;
            level.pressure_index = *hint;
            return level;
        }
        else if (height < hint_height_below)
        {
            // TODO: could search outwards, exponentially increasing
            // above - below until the window includes the target height.
            // caveats: may interp some heights twice, bsearch is quick anyway
            above = *hint;

            if (below == above) // == 0
            {
                fprintf(stderr, "WARN: moved to %.2fm, below height where we "
                                "have data. Assuming we're at %imb or approx "
                                "%.2fm\n",
                        height, axis_1_pressure[0], hint_height_below);
                level.height_below = level.height_above = hint_height_below;
                level.pressure_index = *hint = -1;
                return level;
            }
            else
            {
                height_below = interp_variable(d, hour_index, below, 0, p);
                height_above = hint_height_below;
            }
        }
        else // hint_height_above < height
        {
            below = *hint + 1;

            if (below == above) // == length - 1
            {
                // warn once when entering; then quick path via hint doesn't
                // show the warning.
                fprintf(stderr, "WARN: moved to %.2fm, above height where we "
                                "have data. Assuming we're at %imb or approx "
                                "%.2fm\n",
                        height, axis_1_pressure[length - 1],
                        hint_height_above);
                level.height_below = level.height_above = hint_height_above;
                level.pressure_index = length - 1;
                return level;
            }
            else
            {
                height_below = hint_height_above;
                height_above = interp_variable(d, hour_index, above, 0, p);
            }
        }
    }

    while (above - below > 1)
    {
        // (above - below > 1) => below < mid < above
        int mid = (above + below) / 2;
        double mid_height = interp_variable(d, hour_index, mid, 0, p);

        if (mid_height <= height)
        {
            above = mid;
            height_above = mid_height;
        }
        else // (height < mid_height)
        {
            below = mid;
            height_below = mid_height;
        }
    }

    assert(above - below == 1);
    assert(height_below <= height && height <= height_above);

    level.height_below = height_below;
    level.height_above = height_above;
    level.pressure_index = below;
    return level;
}

// for fixed hour, pressure, variable
// interpolate over lat and lon
static double interp_variable(struct dataset *d, int hour_index, int pressure,
                              int variable, struct interp p)
{
    double nw, ne, sw, se, w, e;
    sw = (*d->array)[hour_index][pressure][variable][p.lat_south][p.lon_west];
    se = (*d->array)[hour_index][pressure][variable][p.lat_south][p.lon_east];
    nw = (*d->array)[hour_index][pressure][variable]
                                [p.lat_south + 1][p.lon_west];
    ne = (*d->array)[hour_index][pressure][variable]
                                [p.lat_south + 1][p.lon_east];

    w = lerp(sw, nw, p.lat_lambda);
    e = lerp(se, ne, p.lat_lambda);
    return lerp(w, e, p.lon_lambda);
}

// for fixed hour, variable
// interpolate over pressure, lat, lon
static double interp_variable2(struct dataset *d, int hour_index,
                               struct level level, double height,
                               int variable, struct interp p)
{
    double height_lambda =
        lambda(level.height_below, level.height_above, height);
    double variable_below =
        interp_variable(d, hour_index, level.pressure_index,
                        variable, p);
    double variable_above =
        interp_variable(d, hour_index, level.pressure_index,
                        variable, p);
    return lerp(variable_below, variable_above, height_lambda);
}

// for fixed variable
// interpolate over pressure, lat, lon
static double interp_variable3(struct dataset *d,
                               struct interp3 p3, int variable)
{
    double variable_before =
        interp_variable2(d, p3.hour_before, p3.level_before, p3.height,
                         variable, p3.p);
    double variable_after =
        interp_variable2(d, p3.hour_before + 1, p3.level_after, p3.height,
                         variable, p3.p);
    return lerp(variable_before, variable_after, p3.hour_lambda);
}

static double lambda(double left, double right, double value)
{
    double width = right - left;
    double offset = value - left;
    double l = offset / width;
    if (l < 0.0)
    {
        if (-tol < l)
            l = 0.0;
        else
            return lambda_fail;
    }
    if (1.0 < l)
    {
        if (l < 1 + tol)
            l = 1.0;
        else
            return lambda_fail;
    }
    return l;
}

static double lambda_axes(const double *axes, int index, double value)
{
    return lambda(axes[index], axes[index + 1], value);
}

static double lerp(double left, double right, double lambda)
{
    return (1.0 - lambda) * left + lambda * right;
}
