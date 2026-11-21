
/* =====================================================
   DRHRoadHazards Archival Project
   MULTI-VIDEO VIEW COUNT COMPARISON

   Reads viewHistory tables from other HTML pages.

   Requires:
   - Chart.js
   - Luxon
   - Chart.js Luxon adapter
   - comparisonSettings in comparison.html
   ===================================================== */


// =====================================================
// 1. ELEMENTS
// =====================================================

const chartCanvas =
    document.getElementById("comparisonChart");

const statusElement =
    document.getElementById("comparisonStatus");

const comparisonTable =
    document.getElementById("comparisonTable");

document.getElementById("comparisonTitle").textContent =
    comparisonSettings.title;


// =====================================================
// 2. RANDOM COLOURS
// =====================================================

function randomColor() {

    const hue = Math.floor(Math.random() * 360);

    return `hsl(${hue}, 70%, 58%)`;

}


// =====================================================
// 3. DATE CONVERSION
// =====================================================

function parseUTCDate(dateText) {

    dateText = dateText.trim();

    let isoDate;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {

        isoDate = dateText + "T00:00:00Z";

    } else {

        isoDate = dateText.replace(" ", "T");

        if (!/(Z|[+-]\d{2}:\d{2})$/i.test(isoDate)) {
            isoDate += "Z";
        }

    }

    return Date.parse(isoDate);

}


function formatDate(timestamp) {

    return new Date(timestamp)
        .toISOString()
        .replace("T", " ")
        .replace(".000Z", " UTC");

}


// =====================================================
// 4. READ A VIDEO'S HTML PAGE
// =====================================================

async function loadVideo(video) {

    const response = await fetch(video.file);

    if (!response.ok) {

        throw new Error(
            `Could not load ${video.file}: HTTP ${response.status}`
        );

    }

    const html = await response.text();

    const parser = new DOMParser();

    const documentPage = parser.parseFromString(
        html,
        "text/html"
    );

    const table = documentPage.getElementById("viewHistory");

    if (!table) {

        throw new Error(
            `No viewHistory table found in ${video.file}`
        );

    }


    const data = [];

    table.querySelectorAll("tr").forEach(row => {

        const cells = row.querySelectorAll("td");

        if (cells.length !== 3) return;

        const timestamp = parseUTCDate(
            cells[0].textContent
        );

        const views = Number(
            cells[1].textContent
                .replace(/,/g, "")
                .trim()
        );

        if (
            Number.isFinite(timestamp) &&
            Number.isFinite(views) &&
            views >= 0
        ) {

            data.push({

                x: timestamp,

                y: views,

                source: cells[2].textContent.trim(),

                video: video.name

            });

        }

    });


    // Sort measurements chronologically.

    data.sort((a, b) => a.x - b.x);


    if (data.length === 0) {

        throw new Error(
            `No valid measurements found in ${video.file}`
        );

    }


    return {

        name: video.name,

        file: video.file,

        color: randomColor(),

        data: data,

        firstDate: data[0].x,

        lastDate: data[data.length - 1].x,

        highestViews: Math.max(
            ...data.map(point => point.y)
        )

    };

}


// =====================================================
// 5. CREATE COMPARISON TABLE
// =====================================================

function updateComparisonTable(videos) {

    comparisonTable.innerHTML = "";

    videos.forEach(video => {

        const row = document.createElement("tr");

        const values = [

            video.name,

            formatDate(video.firstDate),

            formatDate(video.lastDate),

            video.highestViews.toLocaleString(),

            video.data.length

        ];

        values.forEach(value => {

            const cell = document.createElement("td");

            cell.textContent = value;

            row.appendChild(cell);

        });


        // Colour indicator.

        row.cells[0].style.borderLeft =
            `5px solid ${video.color}`;

        comparisonTable.appendChild(row);

    });

}


// =====================================================
// 6. BUILD GRAPH DATASETS
// =====================================================

function createDatasets(videos) {

    return videos.map(video => ({

        label: video.name,

        data: video.data,

        borderColor: video.color,

        backgroundColor: video.color,

        pointBackgroundColor: video.color,

        pointBorderColor: video.color,

        pointRadius: 4,

        pointHoverRadius: 8,

        borderWidth: 2,

        tension: 0,

        fill: false,

        spanGaps: false

    }));

}


// =====================================================
// 7. DETERMINE SHARED AXIS LIMITS
// =====================================================

function calculateLimits(videos) {

    const allDates = videos.flatMap(video =>
        video.data.map(point => point.x)
    );

    const allViews = videos.flatMap(video =>
        video.data.map(point => point.y)
    );


    const earliestDate = Math.min(...allDates);

    const latestDate = Math.max(...allDates);

    const highestViews = Math.max(...allViews);


    // Prevent identical X-axis limits.

    const xMin = earliestDate;

    const xMax = latestDate === earliestDate
        ? latestDate + 86400000
        : latestDate;


    // Add a little space above the highest measurement.

    const yMax = highestViews === 0
        ? 100
        : Math.ceil(highestViews * 1.05);


    return {

        xMin,
        xMax,
        yMax

    };

}


// =====================================================
// 8. CREATE CHART
// =====================================================

function createChart(videos) {

    const limits = calculateLimits(videos);

    const datasets = createDatasets(videos);


    new Chart(chartCanvas, {

        type: "line",

        data: {

            datasets: datasets

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            parsing: true,

            interaction: {

                mode: "nearest",

                intersect: false

            },


            scales: {

                x: {

                    type: "time",

                    min: limits.xMin,

                    max: limits.xMax,

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

                    max: limits.yMax,

                    title: {

                        display: true,

                        text: "Views",

                        color: "white"

                    },

                    ticks: {

                        color: "white",

                        callback: function(value) {

                            return value.toLocaleString();

                        }

                    },

                    grid: {

                        color: "#555"

                    }

                }

            },


            plugins: {

                legend: {

                    position: "top",

                    labels: {

                        color: "white",

                        usePointStyle: true

                    }

                },


                tooltip: {

                    callbacks: {

                        title: function(items) {

                            return formatDate(
                                items[0].parsed.x
                            );

                        },


                        label: function(context) {

                            return context.dataset.label +
                                ": " +
                                context.parsed.y.toLocaleString() +
                                " views";

                        },


                        afterLabel: function(context) {

                            return "Source: " +
                                context.raw.source;

                        }

                    }

                }

            }

        }

    });

}


// =====================================================
// 9. LOAD ALL VIDEOS
// =====================================================

async function startComparison() {

    statusElement.textContent =
        "Loading video histories...";

    try {

        const results = await Promise.allSettled(

            comparisonSettings.videos.map(video =>
                loadVideo(video)
            )

        );


        const videos = [];

        const errors = [];


        results.forEach((result, index) => {

            if (result.status === "fulfilled") {

                videos.push(result.value);

            } else {

                errors.push(

                    comparisonSettings.videos[index].name +
                    ": " +
                    result.reason.message

                );

            }

        });


        if (videos.length === 0) {

            throw new Error(
                "No video histories could be loaded."
            );

        }


        // Build comparison.

        updateComparisonTable(videos);

        createChart(videos);


        // Status information.

        statusElement.textContent =
            videos.length +
            " video(s) loaded successfully.";


        if (errors.length > 0) {

            statusElement.textContent +=
                " Some videos could not be loaded: " +
                errors.join(" | ");

            console.warn(errors);

        }

    }

    catch (error) {

        statusElement.textContent =
            "Comparison error: " + error.message;

        console.error(error);

    }

}


// =====================================================
// 10. START
// =====================================================

startComparison();


// =====================================================
// END OF COMPARISON.JS
// =====================================================
