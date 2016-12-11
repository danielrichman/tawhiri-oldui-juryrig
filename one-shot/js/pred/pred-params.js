/*
 * CUSF Landing Prediction Version 3
 * Daniel Richman 2016
 *
 * We have three ways of representing prediction parameters and three
 * places we store them respectively. They are:
 *  1) In the URL (html5 locaiton etc.) "packed query string"
 *  2) In the HTML form "form"
 *  3) As a JSON request we send to the server "request object"
 * We need functions for most (but not all) edges of the triangle.
 * This file provides them.
 */

// poor man's RFC3339, UTC only.
function rough_validate_rfc3339_utc(s) {
    if (s.length != 'YYYY-MM-DDTHH:MM:SSZ'.length)
        return false;

    var d;

    try {
        d = new Date(s);
    } catch (exn) {
        return false;
    }   

    if (isNaN(d.getUTCMinutes()))
        return false;

    return true;
}

function assert_request_object_valid(obj) {
    function sane_alt(x) {
        return x === +x && !isNaN(x) && 0 <= x && x <= 50000;
    }
    function sane_rate(x) {
        return x === +x && !isNaN(x) && 0 < x && x < 50;
    }
    function sane_lat(x) {
        return x === +x && !isNaN(x) && -90 <= x && x <= 90;
    }
    function sane_lon(x) {
        return x === +x && !isNaN(x) && -180 <= x && x <= 360;
    }
    var checks =
        { launch_latitude  : sane_lat
        , launch_longitude : sane_lon
        , launch_altitude  : sane_alt
        , launch_datetime  : rough_validate_rfc3339_utc
        , ascent_rate      : sane_rate
        , burst_altitude   : sane_alt
        , descent_rate     : sane_rate
        };

    for (var key in checks)
        if (!checks[key](obj[key]))
            throw "Invalid " + key;

    for (var key in obj)
        if (checks[key] === undefined)
            throw "Unexpected key " + key;
}

// Tries to unpack parameters from the URL, if we can. Otherwise null
function packed_query_string_to_request_object(s) {
    s = s.split(",");
    
    if (s.length != 7)
        return null;

    var r = 
        { launch_latitude  : +s[0]
        , launch_longitude : +s[1]
        , launch_altitude  : +s[2]
        , launch_datetime  : s[3]
        , ascent_rate      : +s[4]
        , burst_altitude   : +s[5]
        , descent_rate     : +s[6]
        };

    try {
        assert_request_object_valid(r);
    } catch (exn) {
        return null;
    }

    return r;
}

function request_object_to_packed_url(obj) {
    var r = 
        [ obj.launch_latitude 
        , obj.launch_longitude
        , obj.launch_altitude 
        , obj.launch_datetime
        , obj.ascent_rate    
        , obj.burst_altitude
        , obj.descent_rate 
        ];

    return r.join(",");
}

function read_request_object_from_current_url() {
    if (!document.location.search)
        return null;

    var s = "" + document.location.search;

    if (s[0] == "?")
        s = s.substring(1);

    return packed_query_string_to_request_object(s);
}

function push_request_object_to_history(obj) {
    window.history.pushState(null, null, "?" + request_object_to_packed_url(obj));
}

function overwrite_one_shot_form_with_request_object(obj) {
    $("#lat").val(obj.launch_latitude);
    $("#lon").val(obj.launch_longitude);
    $("#initial_alt").val(obj.launch_altitude);
    var date = new Date(obj.launch_datetime);
    $("#year").val(date.getUTCFullYear());
    $("#month").val(date.getUTCMonth() + 1);
    $("#day").val(sprintf("%02i", date.getUTCDate()));
    $("#hour").val(sprintf("%02i", date.getUTCHours()));
    $("#min").val(sprintf("%02i", date.getUTCMinutes()));
    $("#ascent").val(obj.ascent_rate);
    $("#descent").val(obj.descent_rate);
    $("#burst").val(obj.burst_altitude);
}

function read_request_object_from_one_shot_form() {
    function num(selector) {
        var val = $(selector).val();
        if (val === "") 
            return NaN;
        else 
            return +val;
    }   

    var launch_datetime =
        sprintf("%04i-%02i-%02iT%02i:%02i:%02iZ",
            num("#year"), num("#month"), num("#day"),
            num("#hour"), num("#min"), 0);

    var r = 
        { launch_latitude  : num("#lat")
        , launch_longitude : num("#lon")
        , launch_altitude  : num("#initial_alt")
        , launch_datetime  : launch_datetime
        , ascent_rate      : num("#ascent") 
        , burst_altitude   : num("#burst") 
        , descent_rate     : num("#descent") 
        };  

    assert_request_object_valid(r);

    return r;
}
