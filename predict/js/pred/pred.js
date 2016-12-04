/*
 * CUSF Landing Prediction Version 2
 * Jon Sowman 2010
 * jon@hexoc.com
 * http://www.hexoc.com
 *
 * http://github.com/jonsowman/cusf-standalone-predictor
 *
 */

function populateDefaultLaunchTime() {
    // lat and lon are populated by default with the first location
    var date = new Date(Date.now() + 3600*1000);
    $("#year").val(date.getUTCFullYear());
    $("#month").val(date.getUTCMonth() + 1);
    $("#day").val(sprintf("%02i", date.getUTCDate()));
    $("#hour").val(sprintf("%02i", date.getUTCHours()));
    $("#min").val(sprintf("%02i", date.getUTCMinutes()));
}

function request_prediction(req_obj) {
    appendDebug(null, 1); // clear debug window
    appendDebug("Sending data to server...");
    // Disable form
    $("#modelForm").find("input").attr("disabled", true);
    // Gets in the way of #status_message
    $("#error_window").fadeOut(250);
    // Initialise progress bar
    $("#prediction_status").html("Sending data to server...");

    var still_predicting = true;

    // Defer fading the map out for 500ms. The server is often pretty
    // fast, and it looks kinda weird to fade out and in so fast.
    // If the server doesn't reply in 500ms, chances are it will be 
    // multiple seconds.
    function show_predicting_window() {
        if (!still_predicting) return;

        $("#prediction_status").html("Predicting...");
        $("#status_message").fadeIn(250);
        $("#input_form").hide("slide", { direction: "down" }, 500);
        $("#scenario_info").hide("slide", { direction: "up" }, 500);
        // disable user control of the map canvas
        $("#map_canvas").fadeTo(1000, 0.2);
    }

    setTimeout(show_predicting_window, 500);

    function display_error(error) {
        var x = $("<div>");
        x.append($("<h3>").text(error.type));
        x.append($("<p>").text(error.description));
        throwError(x);
    }

    $.ajax({
        url: "/api/predict", 
        data: req_obj,
        success: function (result) {
            still_predicting = false;
            resetGUI();

            if (result.error) {
                display_error(result.error);
            } else {
                display_prediction(req_obj, result);
            }
        },
        error: function (xhr, _stat, msg) {
            still_predicting = false;
            resetGUI();

            try {
                var result = JSON.parse(xhr.responseText);
                if (result.error === undefined) 
                    throw "JSON error should have error property";
                display_error(result.error);
            } catch(_exn) {
                display_error({type: "AJAX Error", description:msg});
            }
        }
    });
}

// Constructs the path, plots the launch/land/burst markers, writes the
// prediction information to the scenario information window
function display_prediction(prediction_request, result_from_server) {
    var path = [];

    var launch_lat;
    var launch_lon;
    var land_lat;
    var land_lon;
    var launch_pt;
    var land_pt;
    var burst_lat;
    var burst_lon;
    var burst_alt;
    var burst_pt;
    var burst_time;
    var launch_time;
    var land_time;

    var prediction = result_from_server.predictions[0];

    if (prediction.warnings) {
        var x = $("<div>");
        x.append($("<h3>").text("Some warnings occured. Prediction may be unreliable."));
        for (var key in prediction.warnings)
        {
            var w = prediction.warnings[key];
            x.append($("<p>").text(w.description + " (" + w.count + ")"));
        }
        throwError(x);
        setTimeout(function () { toggleWindow("scenario_template", "showHideDebug", "Show Debug", "Hide Debug", "show");}, 100);
    }

    var stages = prediction.prediction; // :-(

    $.each(stages, function(_idx, stage) { 
        if (stage.stage == "launch") {
            launch_pt = new google.maps.LatLng(stage.latitude, stage.longitude);
            launch_lat = stage.latitude;
            launch_lon = stage.longitude;
            launch_time = stage.datetime;
        } else if (stage.stage == "burst") {
            burst_pt = new google.maps.LatLng(stage.latitude, stage.longitude);
            burst_lat = stage.latitude;
            burst_lon = stage.longitude;
            burst_time = stage.datetime;
            burst_alt = stage.altitude;
        } else if (stage.stage == "land") {
            land_pt = new google.maps.LatLng(stage.latitude, stage.longitude);
            land_lat = stage.latitude;
            land_lon = stage.longitude;
            land_time = stage.datetime;
        } else if (stage.stage == "ascent" || stage.stage == "descent") {
            $.each(stage.path, function (_idx2, point) {
                var point = new google.maps.LatLng(point.latitude, point.longitude);
                path.push(point);
            });
        }
    });

    appendDebug("Flight data parsed, creating map plot...");
    clearMapItems();
    
    // Calculate range and time of flight
    var range = distHaversine(launch_pt, land_pt, 1);
    var flighttime = (Date.parse(land_time) - Date.parse(launch_time)) / 1000;
    var f_hours = Math.floor(flighttime / 3600);
    var f_minutes = Math.floor((flighttime % 3600) / 60);
    if ( f_minutes < 10 ) f_minutes = "0"+f_minutes;
    flighttime = f_hours + "hr" + f_minutes;
    $("#cursor_pred_range").html(range);
    $("#cursor_pred_time").html(flighttime);
    cursorPredShow();
    
    // Make some nice icons
    var launch_icon = new google.maps.MarkerImage(launch_img,
        new google.maps.Size(10,10),
        new google.maps.Point(0, 0),
        new google.maps.Point(5, 5)
    );
    
    var land_icon = new google.maps.MarkerImage(land_img,
        new google.maps.Size(10,10),
        new google.maps.Point(0, 0),
        new google.maps.Point(5, 5)
    );

    var burst_icon = new google.maps.MarkerImage(burst_img,
        new google.maps.Size(16, 16),
        new google.maps.Point(0, 0),
        new google.maps.Point(8, 8)
    );

    function short_time(rfc3339) {
        var d = new Date(rfc3339);
        return sprintf("%02i:%02i UTC", d.getUTCHours(), d.getUTCMinutes());
    }

    var launch_marker = new google.maps.Marker({
        position: launch_pt,
        map: map,
        icon: launch_icon,
        title: 'Balloon launch ('+launch_lat+', '+launch_lon+') at ' + short_time(launch_time)
    });

    var land_marker = new google.maps.Marker({
        position: land_pt,
        map:map,
        icon: land_icon,
        title: 'Predicted Landing ('+land_lat+', '+land_lon+') at ' + short_time(land_time)
    });

    var pop_marker = new google.maps.Marker({
            position: burst_pt,
            map: map,
            icon: burst_icon,
            title: 'Balloon burst (' + burst_lat + ', ' + burst_lon 
                + ' at altitude ' + burst_alt + 'm) at ' + short_time(burst_time)
    });

    var path_polyline = new google.maps.Polyline({
        path: path,
        map: map,
        strokeColor: '#000000',
        strokeWeight: 3,
        strokeOpacity: 0.75
    });

    // Add the launch/land markers to map
    // We might need access to these later, so push them associatively
    map_items['launch_marker'] = launch_marker;
    map_items['land_marker'] = land_marker;
    map_items['pop_marker'] = pop_marker;
    map_items['path_polyline'] = path_polyline;

    // Pan to the new position
    map.panTo(launch_pt);
    map.setZoom(8);

    // populate the download links
    $("#dlcsv").attr("href", "/api/predict?format=csv&" + $.param(prediction_request));
    $("#dlkml").attr("href", "/api/predict?format=kml&" + $.param(prediction_request));
    $("#panto").click(function() {
            map.panTo(map_items['launch_marker'].position);
            //map.setZoom(7);
    });
    $("#dataset").html(result_from_server.dataset);

    return true;
}

// This function runs when the document object model is fully populated
// and the page is loaded
$(document).ready(function() {
    // Initialise the map canvas with parameters (lat, long, zoom-level)
    initMap(52, 0, 8);

    // Populate the launch site list from sites.json
    populateLaunchSite();

    // Initialise UI elements such as draggable windows
    initUI();
    
    // Check if an old prediction is to be displayed, and process if so
    var url_scenario = read_request_object_from_current_url();
    if (url_scenario) {
        overwrite_form_with_request_object(url_scenario);
        request_prediction(url_scenario);
    } else {
        populateDefaultLaunchTime();
    }

    // Plot the initial launch location
    plotClick();

    // Initialise the burst calculator
    calc_init();

    // pred-ui concerns itself with the human/non-business bits of the UI and
    // adds most of the event handlers. Prediction requests are handled here.

    $("#modelForm").submit(function (evt) {
        evt.preventDefault();

        var req;

        try {
            req = read_request_object_from_form();
        } catch (e) {
            throwError(e);
            return;
        }

        push_request_object_to_history(req);
        request_prediction(req);
    }); 

    // Watch history
    window.onpopstate = function() {
        var url_scenario = read_request_object_from_current_url();
        if (url_scenario) {
            overwrite_form_with_request_object(url_scenario);
            request_prediction(url_scenario);
        }
    }
});

// Clear the Launch Site dropdown and repopulate it with the information from
// sites.json, as well as an "Other" option to open the saved locations window
function populateLaunchSite() {
    $("#site > option").remove();
    $.getJSON("sites.json", function(sites) {
        $.each(sites, function(sitename, site) {
            $("<option>").attr("value", sitename).text(sitename).appendTo("#site");
        });
        $("<option>").attr("value", "Other").text("Other").appendTo("#site");
        return true;
    });
    return true;
}

// The onchange handler for the launch locations dropdown menu, which opens
// the saved locations window if "Other" was chosen; sets the launch card
// lat/lon and plots the new launch location otherwise
function changeLaunchSite() {
    var selectedName = $("#site").val();
    if ( selectedName == "Other" ) {
        appendDebug("User requested locally saved launch sites");
        if ( constructCookieLocationsTable("cusf_predictor") ) {
            $("#location_save_local").fadeIn();
        }
    } else {
        $.getJSON("sites.json", function(sites) {
            $.each(sites, function(sitename, site) {
               if ( selectedName == sitename ) {
                    $("#lat").val(site.latitude);
                    $("#lon").val(site.longitude);
                    $("#initial_alt").val(site.altitude);
               }
            });
            plotClick();
        });
    }
}

// Return the size of a given associative array
function getAssocSize(arr) {
    var i = 0;
    for ( j in arr ) {
        i++;
    }
    return i;
}

rad = function(x) {return x*Math.PI/180;}
