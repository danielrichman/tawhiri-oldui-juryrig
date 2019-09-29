/* CUSF Landing Prediction Version 3 */

var map_object = null;
var predictions = {};

function init_map(centre_lat, centre_lng) {
    const options = {
        zoom: 8,
        center: new google.maps.LatLng(centre_lat, centre_lng),
        mapTypeId: google.maps.MapTypeId.TERRAIN
    };
    map_object = new google.maps.Map($('#map-canvas')[0], options);
}

function dist_haversine(p1, p2) {
    function rad(x) { return x*Math.PI/180; }

    const R = 6371;
    const dLat  = rad(p2.lat() - p1.lat());
    const dLong = rad(p2.lng() - p1.lng());

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(rad(p1.lat())) * Math.cos(rad(p2.lat())) * Math.sin(dLong/2) * Math.sin(dLong/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d;
}

function prediction_last_point(data) {
    const last_stage = data.prediction[data.prediction.length - 1];
    return last_stage.trajectory[last_stage.trajectory.length - 1];
}

function add_prediction(data) {
    const last_point = prediction_last_point(data);
    const launch_time = new Date(data.request.launch_datetime);
    const landing_time = new Date(last_point.datetime);

    // Derive the index for the greyscale marker image
    var marker_idx = launch_time.getHours();
    if (marker_idx > 11)
        marker_idx -= (2 * (marker_idx - 12) + 1);

    const last_point_latlng =
        new google.maps.LatLng(last_point.latitude, last_point.longitude);

    const landing_marker_image =
        new google.maps.MarkerImage(
            'images/marker' + marker_idx + ".png",
            new google.maps.Size(11,11),
            new google.maps.Point(0,0), // origin
            new google.maps.Point(5.5,5.5)); // anchor

    const landing_marker =
        new google.maps.Marker({
             position: last_point_latlng,
             icon: landing_marker_image,
             title: launch_time.toString()
        });

    const info_window_content =
        '<p><strong>Launch time:</strong> ' + launch_time.toString() + '</p>' +
        '<p><strong>Landing time:</strong> ' + landing_time.toString() + '</p>' +
        '<p><strong>Landing location:</strong> ' + last_point.latitude + '&deg;N ' + last_point.longitude + '&deg;E</p>'

    const info_window = new google.maps.InfoWindow({ content: info_window_content });

    const trails_row = $('<tr>');
    trails_row.append($('<td>').text(launch_time.toLocaleDateString()));
    trails_row.append($('<td>').text(launch_time.toLocaleTimeString()));
    const duration = ((landing_time - launch_time) / (1000*60*60));
    trails_row.append($('<td>').text(duration.toPrecision(3) + ' hrs'));
    const launch_point = new google.maps.LatLng(data.request.launch_latitude, data.request.launch_longitude);
    const distance = dist_haversine(launch_point, last_point_latlng);
    trails_row.append($('<td>').text(distance.toFixed(1) + ' km'));
    const hide_link = $('<a href="#">').text("hide");
    const info_link = $('<a href="#">').text("info");
    const links_td = $('<td>').append(hide_link).append(" ").append(info_link);
    trails_row.append(links_td);

    const trails_tbody = $("table#trails tbody");

    var path = [];
    var pop_point = null;

    data.prediction.forEach(function (stage) {
        if (stage.stage == "descent") {
            pop_point = stage.trajectory[0];
        }

        stage.trajectory.forEach(function (elt) {
            const point = new google.maps.LatLng(elt.latitude, elt.longitude);
            const is_dup = (path.length > 0 && point.equals(path[path.length - 1]));
            if (!is_dup) {
                path.push(point);
            }
        });
    });

    const path_polyline =
        new google.maps.Polyline({
            path: path,
            strokeColor: '#000000',
            strokeWeight: 3,
            strokeOpacity: 0.75
        });

    var pop_marker = null;

    if (pop_point !== null) {
        const pop_icon =
            new google.maps.MarkerImage(
                'images/pop-marker.png',
                new google.maps.Size(16, 16),
                new google.maps.Point(0, 0),
                new google.maps.Point(8, 8));

        pop_marker =
            new google.maps.Marker({
                position: new google.maps.LatLng(pop_point.latitude, pop_point.longitude),
                icon: pop_icon,
                title: 'Burst (altitude: ' + pop_point.altitude + 'm)'
            });
    }

    landing_marker.setMap(map_object);

    function show_path() {
        path_polyline.setMap(map_object);
        if (pop_marker !== null) pop_marker.setMap(map_object);
        trails_row.appendTo(trails_tbody);
        $("#trails-box").show();
    }

    function hide_path() {
        path_polyline.setMap(null);
        if (pop_marker !== null) pop_marker.setMap(null);
        trails_row.detach();
        if (trails_tbody.children().length === 0) {
            $("#trails-box").hide();
        }
    }

    function show_info_window() {
        info_window.open(map_object, landing_marker);
    }

    google.maps.event.addListener(path_polyline, 'click', hide_path);
    google.maps.event.addListener(pop_marker, 'click', hide_path);
    google.maps.event.addListener(landing_marker, 'click', show_path);
    google.maps.event.addListener(landing_marker, 'rightclick', show_info_window);
    hide_link.click(hide_path);
    info_link.click(show_info_window);
}

function show_prediction_line(last_points) {
    new google.maps.Polyline({
        path: last_points.map(x => new google.maps.LatLng(x.latitude, x.longitude)),
        map: map_object,
        strokeColor: '#f44',
        strokeOpacity: 0.5,
        strokeWeight: 2
    });
}

$(document).ready(function() {
    const req_obj = read_request_object_from_current_url();
    if (!req_obj) {
        // TODO: display a proper error
        throw "Could not get launch parameters from URL";
    }

    init_map(req_obj.launch_latitude, req_obj.launch_longitude);

    set_scenario_display_to_request_object(req_obj);

    var last_points = [];

    function loop(launch_datetime) {
        const req = Object.assign({launch_datetime: launch_datetime.toISOString()}, req_obj);

        $.ajax({ url: "/api/v1/", data: req, dataType: "json" })
            .done(function (data) {
                add_prediction(data);
                last_points.push(prediction_last_point(data));
                loop(new Date(launch_datetime.getTime() + 3600000));
            })
            .fail(function () {
                show_prediction_line(last_points);
            });
    }

    const now = (new Date()).getTime();
    const first_launch = new Date(now - now % 3600000);

    loop(first_launch);
});
