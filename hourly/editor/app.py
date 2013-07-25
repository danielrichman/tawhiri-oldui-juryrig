import os.path
import json
from flask import Flask, render_template, abort, request

app = Flask(__name__)

scenarios = os.path.join(os.path.dirname(__file__), "..", "scenarios")

@app.route("/<scenario>", methods=["GET", "POST"])
def edit(scenario):
    if scenario in ('', 'scenarios', 'lib', 'edit', 'static') \
            or '.' in scenario or '/' in scenario:
        abort(404)

    filename = os.path.join(scenarios, scenario) + ".json"
    assert os.path.split(filename) == (scenarios, scenario + ".json")

    if not os.path.exists(filename):
        abort(404)

    if request.method == "GET":
        return render_template("login.html", scenario=scenario, error=False)

    with open(filename) as f:
        data = json.load(f)

    password = request.form["password"]
    if password != data["password"]:
        return render_template("login.html", scenario=scenario, error=True)

    errors = {}
    am = data["altitude-model"]

    if "save" in request.form:
        try:
            am["ascent-rate"] = float(request.form["ascent_rate"])
        except ValueError:
            errors["ascent_rate"] = "Bad float"

        try:
            am["descent-rate"] = float(request.form["descent_rate"])
        except ValueError:
            errors["descent_rate"] = "Bad float"

        try:
            am["burst-altitude"] = int(request.form["burst_altitude"])
        except ValueError:
            errors["burst_altitude"] = "Bad int"

    if not (1 <= am["ascent-rate"] <= 10):
        errors["ascent_rate"] = "Need 1 <= ascent rate <= 10"

    if not (1 <= am["descent-rate"] <= 10):
        errors["descent_rate"] = "Need 1 <= descent rate <= 10"

    if not (1000 <= am["burst-altitude"] <= 45000):
        errors["burst_altitude"] = "Need 1000 <= burst altitude <= 45000"

    kwargs = data.copy()
    kwargs["scenario"] = scenario
    kwargs["site"] = kwargs["launch-site"]
    kwargs["ascent_rate"] = am["ascent-rate"]
    kwargs["descent_rate"] = am["descent-rate"]
    kwargs["burst_altitude"] = am["burst-altitude"]
    kwargs["errors"] = errors

    if "save" in request.form and not errors:
        with open(filename, "w") as f:
            json.dump(data, f, indent=4, sort_keys=True)
        kwargs["saved"] = True

    return render_template("edit.html", **kwargs)

if __name__ == '__main__':
    app.run(debug=True)
