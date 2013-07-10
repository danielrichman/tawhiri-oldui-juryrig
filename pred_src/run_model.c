// --------------------------------------------------------------
// CU Spaceflight Landing Prediction
// Copyright (c) CU Spaceflight 2009, All Right Reserved
//
// Written by Rob Anderson 
// Modified by Fergus Noble
//
// THIS CODE AND INFORMATION ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY 
// KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
// PARTICULAR PURPOSE.
// --------------------------------------------------------------

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>

#include "dataset.h"
#include "run_model.h"
#include "pred.h"
#include "altitude.h"

extern int verbosity;

#define RADIUS_OF_EARTH 6371009.0

typedef struct model_state_s model_state_t;
struct model_state_s
{
    double              lat;
    double              lng;
    double              alt;
    altitude_model_t   *alt_model;
};

// Get the distance (in metres) of one degree of latitude and one degree of
// longitude. This varys with height (not much grant you).
static void
_get_frame(double lat, double lng, double alt, 
           double *d_dlat, double *d_dlng)
{
    double theta, r;

    theta = 2.0 * M_PI * (90.0 - lat) / 360.0;
    r = RADIUS_OF_EARTH + alt;

    // See the differentiation section of
    // http://en.wikipedia.org/wiki/Spherical_coordinate_system

    // d/dv = d/dlat = -d/dtheta
    *d_dlat = (2.0 * M_PI) * r / 360.0;

    // d/du = d/dlong = d/dphi
    *d_dlng = (2.0 * M_PI) * r * sinf(theta) / 360.0;
}

static int 
_advance_one_timestep(struct dataset *dataset,
                      unsigned long delta_t,
                      unsigned long timestamp, unsigned long initial_timestamp,
                      model_state_t *state)
{
    double ddlat, ddlng;
    double wind_v, wind_u;

    if(!altitude_model_get_altitude(state->alt_model, 
                                    timestamp - initial_timestamp, &state->alt))
        return 0; // alt < 0; finished

    while (state->lat < -90)  state->lat += 180;
    while (state->lat > 90)   state->lat -= 180;
    while (state->lng < 0)    state->lng += 360;
    while (state->lng > 360)  state->lng -= 360;

    if (timestamp - dataset->start_time >= axis_0_hour[shape[0] - 1] * 3600) {
        fprintf(stderr, "ERROR: prediction reached end of dataset (time axis)\n");
        return -1;
    }

    if(!get_wind(dataset, state->lat, state->lng, state->alt, timestamp, 
                &wind_v, &wind_u))
    {
        fprintf(stderr, "ERROR: couldn't get wind for %f, %f alt %f at %li (point not in dataset?)\n",
                state->lat, state->lng, state->alt, timestamp);
        return -1; // error
    }

    _get_frame(state->lat, state->lng, state->alt, &ddlat, &ddlng);

    state->lat += wind_v * delta_t / ddlat;
    state->lng += wind_u * delta_t / ddlng;

    return 1; // OK, and continue
}

int run_model(struct dataset *dataset, altitude_model_t* alt_model,
              double initial_lat, double initial_lng, double initial_alt,
              long int initial_timestamp)
{
    model_state_t state;

    state.alt = initial_alt;
    state.lat = initial_lat;
    state.lng = initial_lng;
    state.alt_model = alt_model;

    long int timestamp = initial_timestamp;
    
    int log_counter = 0; // only write position to output files every LOG_DECIMATE timesteps
    int r, return_code = 1;

    while(1)
    {
        r = _advance_one_timestep(dataset, TIMESTEP, timestamp, initial_timestamp, &state);
        if (r == -1) // error getting wind. Save prediction, but emit error messages
            return_code = 0;

        if (r != 1) // 1 = continue
            break;

        // write the maximum likelihood state out.
        if (log_counter == LOG_DECIMATE) {
            write_position(state.lat, state.lng, state.alt, timestamp);
            log_counter = 0;
        }

        log_counter++;
        timestamp += TIMESTEP;
    }

    write_position(state.lat, state.lng, state.alt, timestamp);

    return return_code;
}

// vim:sw=4:ts=4:et:cindent
