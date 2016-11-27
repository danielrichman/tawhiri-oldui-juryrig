/*
 * CUSF Landing Prediction Version 2
 * Jon Sowman 2010
 * jon@hexoc.com
 * http://www.hexoc.com
 *
 * http://github.com/jonsowman/cusf-standalone-predictor
 *
 */

// Tries to unpack parameters from the URL, if we can. Otherwise null
function unpackURL() {
    if (!document.location.search)
        return null;

    var s = "" + document.location.search;
    s.split(",");
    
    if (s.length != 7)
        return null;

    if (s[3].length != 'YYYY-MM-DDTHH:MM:SSZ'.length)
        return null;

    try {
        new Date(s[3]);
    } catch {
        return null;
    }

    var r = \
        { launch_latitude  : +s[0]
        , launch_longitude : +s[1]
        , launch_altitude  : +s[2]
        , launch_datetime  : s[3]
        , ascent_rate      : +s[4]
        , burst_altitude   : +s[5]
        , descent_rate     : +s[6]
        };

    for (var key in r)
        if (isNaN(r[key]))
            return null;

    return r;
}

function packURL(obj) {
    var r = \
        [ obj.launch_latitude 
        , obj.launch_longitude
        , obj.launch_altitude 
        , obj.launch_datetime
        , obj.ascent_rate    
        , obj.burst_altitude
        , obj.descent_rate 
        ];

    var s = r.join(",");
}

function pushToHistoryAndRequestPrediction(obj) {
    window.history.pushState(null, null, packURL(obj));
    requestPrediction(obj);
}

function requestPrediction(obj) {
    appendDebug(null, 1); // clear debug window
    appendDebug("Sending data to server...");
    // Disable form
    $("#modelForm").find("input").attr("disabled", true);
    // Gets in the way of #status_message
    $("#error_window").fadeOut(250);
    // Initialise progress bar
    $("#prediction_status").html("Sending data to server...");

    var still_predicting = true;

    function showPredictingWindow() {
        if (!still_predicting) return;

        $("#prediction_status").html("Predicting...");
        $("#status_message").fadeIn(250);
        $("#input_form").hide("slide", { direction: "down" }, 500);
        $("#scenario_info").hide("slide", { direction: "up" }, 500);
        // disable user control of the map canvas
        $("#map_canvas").fadeTo(1000, 0.2);
    }

    setTimeout(showPredictingWindow, 500);

    $.getJSON("/api/predict", obj, function (result) {
        still_predicting = false;

        if (result.error) {
            var x = $("<h3>").text(result.type);
            x.append($("<p>").text(result.description));
            throwError(x);
        } else {
            if (result.warnings) {
                var x = $("<div>");
                x.append($("<h3>").text("Some warnings occured. Prediction may be unreliable."));
                for (var key in result.warnings)
                {
                    var w = result.warnings[key];
                    x.append($("<p>").text(w.description + " (" + w.count = ")"))
                }
                throwError(x);
                setTimeout(function () { toggleWindow("scenario_template", "showHideDebug", "Show Debug", "Hide Debug", "show");}, 100);
            }
            resetGUI();
            displayPrediction(result);
        }
    });
}

// Constructs the path, plots the launch/land/burst markers, writes the
// prediction information to the scenario information window
function displayPrediction(prediction_request, result_from_server) {
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

    var stages = result_from_server.predictions[0].prediction;

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
            }
        }
    });

    appendDebug("Flight data parsed, creating map plot...");
    clearMapItems();
    
    // Calculate range and time of flight
    var range = distHaversine(launch_pt, land_pt, 1);
    var flighttime = Date.parse(land_time) - Date.parse(launch_time);
    var f_hours = Math.floor((flighttime % 86400) / 3600);
    var f_minutes = Math.floor(((flighttime % 86400) % 3600) / 60);
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
      
    var launch_marker = new google.maps.Marker({
        position: launch_pt,
        map: map,
        icon: launch_icon,
        title: 'Balloon launch ('+launch_lat+', '+launch_lon+') at ' + launch_time + "UTC"
    });

    var land_marker = new google.maps.Marker({
        position: land_pt,
        map:map,
        icon: land_icon,
        title: 'Predicted Landing ('+land_lat+', '+land_lon+') at ' + land_time + "UTC"
    });

    var pop_marker = new google.maps.Marker({
            position: burst_pt,
            map: map,
            icon: burst_icon,
            title: 'Balloon burst (' + burst_lat + ', ' + burst_lon 
                + ' at altitude ' + burst_alt + 'm) at ' + burst_time + "UTC"
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

    // Setup all event handlers in the UI using jQuery
    setupEventHandlers();

    // Initialise UI elements such as draggable windows
    initUI();
    
    // Check if an old prediction is to be displayed, and process if so
    var url_scenario = unpackURL();
    if (url_scenario) requestPrediction(url_scenario);

    // Plot the initial launch location
    plotClick();

    // Initialise the burst calculator
    calc_init();
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
