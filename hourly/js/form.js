function show_problems(problems) {
    $("#editor .control-group").removeClass("error");
    $("#editor .help-inline").text("");
    $("#general-errors-container").hide();
    $("#general-errors").empty();

    function add_general_error(msg) {
        $("#general-errors-container").show();
        $("#general-errors").append($("<li>").text(problem.msg));
    }

    for (var i = 0; i < problems.length; i++) {
        var problem = problems[i];

        if (problem.type == "key-validation") {
            var g = $("#grp-" + problem.key);
            if (g.length === 1) {
                g.addClass("error");
                g.find(".help-inline").text(problem.msg);
            } else {
                add_general_error("Invalid " + problem.key + ": " + problem.msg);
            }
        } else if (problem.type == "other") {
            add_general_error(problem.msg);
        } else {
            throw "Don't know how to handle problem";
        }
    }
}

$(document).ready(function () {
    show_problems([]);

    var req_obj = read_request_object_from_current_url();

    if (req_obj) {
        overwrite_hourly_form_with_request_object(req_obj);
    }

    $("#editor-form").submit(function (evt) {
        var req_obj = unvalidated_read_request_object_from_hourly_form();
        var p = request_object_problems(req_obj);

        if (p.length > 0) {
            evt.preventDefault();
            show_problems(p);
        } else {
            show_problems([]);
        }
    });
});
