
/* =====================================================
   DRHRoadHazards Archival Project
   View Count Graph & Milestone Estimator

   Requirements:
   - HTML table ID: viewHistory
   - Canvas ID: viewsChart
   - Milestone table ID: milestoneTable

   ===================================================== */


// =====================================================
// 1. SETTINGS
// =====================================================

// Edit this list to add or remove milestones.

const milestones = [
    100000,
    150000,
    200000,
    250000,
    300000,
    350000,
    400000,
    450000,
    500000,
    600000,
    700000,
    800000,
    900000,
    1000000
];


// Graph appearance

const graphColor = "#4285cc";
const milestoneColor = "#e6b84a";


// =====================================================
// 2. HTML ELEMENTS
// =====================================================

const historyTable = document.getElementById("viewHistory");
const canvas = document.getElementById("viewsChart");
const milestoneTable = document.getElementById("milestoneTable");

if (!historyTable || !canvas || !milestoneTable) {
    throw new Error(
        "Missing HTML elements: viewHistory, viewsChart or milestoneTable."
    );
}


// Create or locate the milestone table body.

let milestoneRows = document.getElementById("milestoneRows");

if (!milestoneRows) {
    milestoneRows = document.createElement("tbody");
    milestoneRows.id = "milestoneRows";
    milestoneTable.appendChild(milestoneRows);
}



// =====================================================
// 2A. MILESTONE DISPLAY TOGGLES
// =====================================================

// Keep the canvas in its original parent and preserve its dimensions.
// Position the controls independently beside the graph.

const graphParent = canvas.parentElement;

if (getComputedStyle(graphParent).position === "static") {
    graphParent.style.position = "relative";
}

const milestoneControls = document.createElement("div");

milestoneControls.style.position = "absolute";
milestoneControls.style.top = "0";
milestoneControls.style.left = "calc(100% + 12px)";
milestoneControls.style.display = "flex";
milestoneControls.style.flexDirection = "column";
milestoneControls.style.gap = "8px";
milestoneControls.style.color = "white";
milestoneControls.style.fontFamily = "Arial, sans-serif";
milestoneControls.style.fontSize = "14px";
milestoneControls.style.whiteSpace = "nowrap";
milestoneControls.style.zIndex = "10";

function createMilestoneToggle(labelText, checked) {

    const label = document.createElement("label");

    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = checked;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(labelText));

    milestoneControls.appendChild(label);

    return checkbox;
}

const showMilestoneTable = createMilestoneToggle(
    "Estimation table",
    true
);

const showMilestonePoints = createMilestoneToggle(
    "Estimation points",
    true
);

graphParent.appendChild(milestoneControls);

const originalMilestoneTableDisplay = milestoneTable.style.display;

showMilestoneTable.addEventListener("change", () => {

    milestoneTable.style.display = showMilestoneTable.checked
        ? originalMilestoneTableDisplay
        : "none";

});

showMilestonePoints.addEventListener("change", () => {

    chart.data.datasets[1].hidden = !showMilestonePoints.checked;

    chart.update();

});

// =====================================================
// 3. DATE FORMATTING
// =====================================================

function formatDate(timestamp) {

    return new Date(timestamp)
        .toISOString()
        .replace("T", " ")
        .replace(".000Z", " UTC");

}


// =====================================================
// 4. READ HTML TABLE
// =====================================================

function readMeasurements() {

    const measurements = [];

    historyTable.querySelectorAll("tr").forEach(row => {

        const cells = row.querySelectorAll("td");

        if (cells.length !== 3) return;

        const dateText = cells[0].textContent.trim();

        const views = Number(
            cells[1].textContent
                .replace(/,/g, "")
                .trim()
        );

        // Date-only entries are assigned midnight UTC.

        let isoDate;

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {

            isoDate = dateText + "T00:00:00Z";

        } else {

            isoDate = dateText.replace(" ", "T");

            if (!/(Z|[+-]\d{2}:\d{2})$/i.test(isoDate)) {
                isoDate += "Z";
            }

        }

        const timestamp = Date.parse(isoDate);

        if (
            Number.isFinite(timestamp) &&
            Number.isFinite(views)
        ) {

            measurements.push({

                x: timestamp,
                y: views,

                source: cells[2].textContent.trim()

            });

        }

    });

    // Sort chronologically.

    measurements.sort((a, b) => a.x - b.x);

    return measurements;

}


// =====================================================
// 5. ESTIMATE MILESTONE DATES
// =====================================================

function estimateMilestone(target, data) {

    if (data.length === 0) {
        return null;
    }


    // Check for an exact recorded milestone.

    const exact = data.find(point => point.y === target);

    if (exact) {

        return {

            type: "recorded",

            timestamp: exact.x,

            basis: "Exact recorded measurement",

            first: exact,
            second: exact

        };

    }


    // Check whether the first observation
    // was already above the milestone.

    if (data[0].y > target) {

        return {

            type: "before",

            timestamp: data[0].x,

            basis: "Already above milestone at first observation"

        };

    }


    // Find the first upward crossing.

    for (let i = 0; i < data.length - 1; i++) {

        const first = data[i];
        const second = data[i + 1];

        if (
            first.y < target &&
            second.y > target
        ) {

            // Linear interpolation.

            const fraction =
                (target - first.y) /
                (second.y - first.y);

            const estimatedTimestamp =
                first.x +
                fraction * (second.x - first.x);


            return {

                type: "estimated",

                timestamp: estimatedTimestamp,

                basis:
                    first.y.toLocaleString() +
                    " → " +
                    second.y.toLocaleString(),

                first: first,
                second: second

            };

        }

    }


    // Milestone has not yet been reached
    // in the available measurements.

    if (data[data.length - 1].y < target) {

        return {

            type: "future",

            basis: "Not reached in recorded data"

        };

    }


    return {

        type: "unknown",

        basis: "No upward crossing established"

    };

}


// =====================================================
// 6. MILESTONE ANNOTATION PLUGIN
// =====================================================

const milestoneLabels = {

    id: "milestoneLabels",

    afterDatasetsDraw(chart) {

        const datasetIndex = 1;

        const meta = chart.getDatasetMeta(datasetIndex);

        if (!meta || !chart.isDatasetVisible(datasetIndex)) return;

        const ctx = chart.ctx;
        const chartArea = chart.chartArea;

        ctx.save();

        ctx.beginPath();

        // Keep annotations inside the graph area.

        ctx.rect(
            chartArea.left,
            chartArea.top,
            chartArea.right - chartArea.left,
            chartArea.bottom - chartArea.top
        );

        ctx.clip();


        meta.data.forEach((point, index) => {

            const milestone =
                chart.data.datasets[datasetIndex].data[index];

            if (!milestone) return;

            const x = point.x;
            const y = point.y;

            const dateLabel =
                new Date(milestone.x)
                    .toISOString()
                    .slice(0, 10);

            const milestoneLabel =
                "EST. " +
                (milestone.milestone / 1000) +
                "K";


            // Determine whether the label fits on the right.

            ctx.font = "bold 11px Arial";

            const labelWidth =
                ctx.measureText(milestoneLabel).width;

            ctx.font = "10px Arial";

            const dateWidth =
                ctx.measureText(dateLabel).width;

            const textWidth = Math.max(
                labelWidth,
                dateWidth
            );

            let direction = 1;

            if (
                x + 20 + textWidth >
                chartArea.right
            ) {

                direction = -1;

            }


            // Horizontal connector.

            const lineStart = x + direction * 5;
            const lineEnd = x + direction * 16;

            const textX = x + direction * 20;


            ctx.strokeStyle = milestoneColor;
            ctx.lineWidth = 1.5;

            ctx.beginPath();

            ctx.moveTo(lineStart, y);
            ctx.lineTo(lineEnd, y);

            ctx.stroke();


            // Milestone label.

            ctx.textAlign =
                direction === 1 ? "left" : "right";

            ctx.textBaseline = "middle";

            ctx.fillStyle = milestoneColor;

            ctx.font = "bold 11px Arial";

            ctx.fillText(
                milestoneLabel,
                textX,
                y - 5
            );


            // Estimated date.

            ctx.fillStyle = "#ffffff";

            ctx.font = "10px Arial";

            ctx.fillText(
                dateLabel,
                textX,
                y + 8
            );

        });

        ctx.restore();

    }

};


// =====================================================
// 7. GENERATE MILESTONE TABLE
// =====================================================

function updateMilestones(data) {

    milestoneRows.innerHTML = "";

    const graphMarkers = [];


    milestones.forEach(target => {

        const result = estimateMilestone(target, data);

        const row = document.createElement("tr");

        const milestoneCell = document.createElement("td");
        const dateCell = document.createElement("td");
        const basisCell = document.createElement("td");


        milestoneCell.textContent =
            target.toLocaleString() + " views";


        if (!result) {

            dateCell.textContent = "No data";

            basisCell.textContent = "—";

        }

        else if (
            result.type === "estimated" ||
            result.type === "recorded"
        ) {

            dateCell.textContent =
                (result.type === "estimated" ? "EST. " : "RECORDED ") +
                formatDate(result.timestamp);

            basisCell.textContent = result.basis;


            // Add the crossing to the graph.

            graphMarkers.push({

                x: result.timestamp,

                y: target,

                milestone: target,

                type: result.type

            });

        }

        else if (result.type === "before") {

            dateCell.textContent =
                "Before " + formatDate(result.timestamp);

            basisCell.textContent = result.basis;

        }

        else {

            dateCell.textContent = "—";

            basisCell.textContent = result.basis;

        }


        row.appendChild(milestoneCell);
        row.appendChild(dateCell);
        row.appendChild(basisCell);

        milestoneRows.appendChild(row);

    });


    return graphMarkers;

}


// =====================================================
// 8. CREATE CHART
// =====================================================

const chart = new Chart(canvas, {

    type: "line",

    plugins: [milestoneLabels],

    data: {

        datasets: [

            // Original view-count graph.

            {

                label: "Views",

                data: [],

                borderColor: graphColor,

                backgroundColor: graphColor,

                pointRadius: 5,

                pointHoverRadius: 8,

                borderWidth: 2,

                tension: 0,

                fill: false

            },


            // Estimated milestone points.

            {

                label: "View milestones",

                data: [],

                showLine: false,

                pointStyle: "circle",

                pointRadius: 4,

                pointHoverRadius: 7,

                backgroundColor: milestoneColor,

                borderColor: "#ffffff",

                borderWidth: 1

            }

        ]

    },


    options: {

        responsive: true,

        maintainAspectRatio: false,

        parsing: true,


        scales: {

            x: {

                type: "time",

                adapters: {

                    date: {

                        zone: "utc"

                    }

                },

                time: {

                    unit: "month",

                    displayFormats: {

                        month: "MMM yyyy"

                    }

                },

                title: {

                    display: true,

                    text: "Date (UTC)",

                    color: "white"

                },

                ticks: {

                    color: "white"

                },

                grid: {

                    color: "#555"

                }

            },


            y: {

                beginAtZero: true,

                title: {

                    display: true,

                    text: "Views",

                    color: "white"

                },

                ticks: {

                    color: "white"

                },

                grid: {

                    color: "#555"

                }

            }

        },


        plugins: {

            legend: {

                labels: {

                    color: "white",

                    filter: function(item) {

                        return item.datasetIndex === 0;

                    }

                }

            },


            tooltip: {

                callbacks: {

                    title: function(items) {

                        return formatDate(items[0].parsed.x);

                    },


                    label: function(context) {

                        const point = context.raw;


                        if (point.milestone) {

                            return (

                                point.type === "estimated"
                                    ? "ESTIMATED MILESTONE: "
                                    : "RECORDED MILESTONE: "

                            ) + point.milestone.toLocaleString() +
                                " views";

                        }


                        return context.parsed.y.toLocaleString() +
                            " views";

                    },


                    afterLabel: function(context) {

                        const point = context.raw;


                        if (point.source) {

                            return "Source: " + point.source;

                        }


                        if (point.milestone) {

                            const result = estimateMilestone(
                                point.milestone,
                                chart.data.datasets[0].data
                            );

                            if (result && result.first && result.second) {

                                return [

                                    "Based on:",

                                    formatDate(result.first.x) +
                                    " — " +
                                    result.first.y.toLocaleString(),

                                    formatDate(result.second.x) +
                                    " — " +
                                    result.second.y.toLocaleString()

                                ];

                            }

                            return "Linear interpolation";

                        }


                        return "";

                    }

                }

            }

        }

    }

});


// =====================================================
// 9. UPDATE GRAPH AND ESTIMATOR
// =====================================================

function updateViewHistory() {

    const data = readMeasurements();


    // Update original graph data.

    chart.data.datasets[0].data = data;


    // Recalculate milestone estimates.

    const markers = updateMilestones(data);


    // Update graph milestone points.

    chart.data.datasets[1].data = markers;


    // Redraw graph and annotations.

    chart.update();

}


// =====================================================
// 10. INITIAL LOAD
// =====================================================

updateViewHistory();


// =====================================================
// 11. AUTOMATIC TABLE CHANGE DETECTION
// =====================================================

const observer = new MutationObserver(() => {

    updateViewHistory();

});

observer.observe(historyTable, {

    childList: true,

    characterData: true,

    subtree: true

});


// =====================================================
// END OF VIEWS.JS
// =====================================================
