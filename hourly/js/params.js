/* CUSF Landing Prediction Version 3 */

function request_object_problems(obj) {
    function assert_legal_number(x) {
        var ok = (x === +x && !isNaN(x));
        if (!ok) throw "Not a number"
    }
    function sane_alt(x) {
        assert_legal_number(x);
        if (x <= 0) throw "Must be positive";
        if (x > 50000) throw "Too large";
    }
    function sane_rate(x) {
        assert_legal_number(x);
        if (x <= 0) throw "Must be positive";
        if (x > 50) throw "Implausibly large";
    }
    function sane_lat(x) {
        assert_legal_number(x);
        if (x < -90 || x > 90) throw "Illegal latitude (should be decimal degrees)";
    }
    function sane_lon(x) {
        assert_legal_number(x);
        if (x < -180 || x > 360) throw "Illegal longitude (should be decimal degrees)";
    }
    function pass(x) {}

    var checks =
        { launch_latitude  : sane_lat
        , launch_longitude : sane_lon
        , launch_altitude  : sane_alt
        , launch_datetime  : pass
        , include_paths    : pass
        , ascent_rate      : sane_rate
        , burst_altitude   : sane_alt
        , descent_rate     : sane_rate
        };

    var problems = [];

    for (var key in checks) {
        try {
            checks[key](obj[key]);
        } catch (msg) {
            problems.push({type: "key-validation", key: key, msg: msg});
        }
    }

    for (var key in obj) {
        if (checks[key] === undefined) {
            problems.push({type: "other", msg: "Unexpected key " + key});
        }
    }

    return problems;
}

function read_request_object_from_current_url() {
    if (!document.location.search)
        return null;

    var query_string = "" + document.location.search;

    if (query_string[0] == "?")
        query_string = query_string.substring(1);

    query_string = query_string.split("&");

    var interesting_keys =
        { launch_latitude  : true
        , launch_longitude : true
        , launch_altitude  : true
        , ascent_rate      : true
        , burst_altitude   : true
        , descent_rate     : true
        };

    var req_obj = 
        { launch_datetime: "hourly"
        , include_paths: "none"
        };

    for (var i = 0; i < query_string.length; i++) {
        var pair = query_string[i].split("=");
        if (pair.length != 2) continue;
        var key = pair[0], value = pair[1];
        if (interesting_keys[key] !== true) continue;
        if (value === "") continue;
        value = +value;
        if (isNaN(value)) continue;
        req_obj[key] = value;
    }

    var p = request_object_problems(req_obj);
    if (p.length > 0) 
        return null;
    else
        return req_obj;
}

function overwrite_hourly_form_with_request_object(obj) {
    for (var key in obj) {
        $("#" + key).val(obj[key]);
    }
}

function set_scenario_display_to_request_object(obj) {
    for (var key in obj) {
        $("#disp-" + key).text(obj[key]);
    }
}

function unvalidated_read_request_object_from_hourly_form() {
    function num(selector) {
        var val = $(selector).val();
        if (val === "")
            return NaN;
        else 
            return +val;
    }

    var r = 
        { launch_latitude  : num("#launch_latitude")
        , launch_longitude : num("#launch_longitude")
        , launch_altitude  : num("#launch_altitude")
        , launch_datetime  : "hourly"
        , include_paths    : "none"
        , ascent_rate      : num("#ascent_rate")
        , descent_rate     : num("#descent_rate")
        , burst_altitude   : num("#burst_altitude")
        };  

    return r;
}
