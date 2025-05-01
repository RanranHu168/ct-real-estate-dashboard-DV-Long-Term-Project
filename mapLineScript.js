// Initialize Leaflet map centered on Connecticut
const map = L.map('map').setView([41.6, -72.65], 9);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 18
}).addTo(map);

// Select D3 tooltip elements for map and line chart
const mapTooltip = d3.select("#mapTooltip");
const lineChartTooltip = d3.select("#lineChartTooltip");

// Prepare line chart SVG layout settings
const lineChartSvg = d3.select("#line-chart");
const lineChartMargin = { top: 20, right: 30, bottom: 30, left: 50 };
const lineChartWidth = lineChartSvg.node().clientWidth - lineChartMargin.left - lineChartMargin.right;
const lineChartHeight = +lineChartSvg.attr("height") - lineChartMargin.top - lineChartMargin.bottom;
const lineChartGroup = lineChartSvg.append("g").attr("transform", `translate(${lineChartMargin.left},${lineChartMargin.top})`);

// Select filter dropdown elements
const townSelect = d3.select("#townSelect");
const yearSelect = d3.select("#yearSelect");

// Global variables
let allData, selectedTown = "All", selectedYear = "All", geoJson;
window.townClicked = false;

// Load geoJSON and CSV data
Promise.all([
    d3.json("CTDOT_Municipalities.geojson"),
    d3.csv("town_data_cleaned.csv", d => ({
        town: d["Town"] ? d["Town"].trim() : "Unknown",
        year: +d["List Year"],
        sale_amount: +d["Sale Amount"],
        assessed: +d["Assessed Value"],
        type: d["Property Type"] && d["Property Type"].toLowerCase().includes("residential") ? "Residential" : "Commercial"
    }))

]).then(([geo, data]) => {
    geoJson = geo;
    window.allData = data;
    console.log("All Data Loaded:", window.allData);

    const towns = [...new Set(data.map(d => d.town))];
    const years = [...new Set(data.map(d => d.year))].sort((a, b) => a - b);

    townSelect.selectAll("option")
        .data(["All", ...towns])
        .join("option")
        .text(d => d);

    yearSelect.selectAll("option")
        .data(["All", ...years])
        .join("option")
        .text(d => d);

    // Set initial filter state
    selectedYear = years[years.length - 1];
    selectedTown = "All";
    window.townClicked = false;

    townSelect.property("value", selectedTown);
    yearSelect.property("value", selectedYear);

    // Dropdown change events
    townSelect.on("change", function() {
        selectedTown = this.value;
        window.townClicked = selectedTown !== "All";
        console.log("Selected town changed to:", selectedTown);
        updateAll();
    });

    yearSelect.on("change", function() {
        selectedYear = this.value === "All" ? "All" : +this.value;
        console.log("Selected year changed to:", selectedYear);
        window.townClicked = false;
        updateAll();
    });

    drawMap();
    drawLineChart();
    updateAll();
});

// Draw the map with town coloring based on average sale price
function drawMap() {
    if (window.layerGroup) map.removeLayer(window.layerGroup);
    window.layerGroup = L.layerGroup().addTo(map);

    const filteredData = window.allData.filter(d => (selectedYear === "All" || d.year === selectedYear));
    const avgByTown = Array.from(d3.group(filteredData, d => d.town), ([town, vals]) => ({
        town,
        avgPrice: d3.mean(vals, d => d.sale_amount)
    }));

    const priceExtent = d3.extent(avgByTown, d => d.avgPrice);
    const colorScale = d3.scaleSequential(d3.interpolateOranges).domain(priceExtent);
    const townToAvg = new Map(avgByTown.map(d => [d.town.toLowerCase(), d.avgPrice]));

    L.geoJSON(geoJson, {
        style: function (f) {
            const townName = f.properties.Municipality;
            const avg = townToAvg.get(townName.toLowerCase());
            const isSelected = (selectedTown === "All" ? false : townName === selectedTown);
            return {
                color: "#666",
                weight: 1,
                fillOpacity: isSelected ? 0.9 : 0.4,
                fillColor: isSelected ? '#ffff33' : (avg ? colorScale(avg) : '#eee')
            };
        },
        onEachFeature: function (feature, layer) {
            const townName = feature.properties.Municipality;
            const townKey = townName.toLowerCase();
            const avg = townToAvg.get(townKey);

            const townData = filteredData.filter(d => d.town.toLowerCase() === townKey);
            const assessedTotal = d3.sum(townData, d => d.assessed);
            const saleTotal = d3.sum(townData, d => d.sale_amount);
            const salesRatio = assessedTotal > 0 ? saleTotal / assessedTotal : null;

            const years = townData.map(d => d.year);
            const minYear = d3.min(years), maxYear = d3.max(years);
            const saleByYear = d3.rollup(
                townData,
                v => d3.mean(v, d => d.sale_amount),
                d => d.year
            );
            const saleStart = saleByYear.get(minYear);
            const saleEnd = saleByYear.get(maxYear);
            const growthRate = (saleStart && saleEnd && saleStart !== 0)
                ? (saleEnd - saleStart) / saleStart
                : null;

            // Map event bindings
            layer.on({
                click: () => {
                    window.townClicked = true;
                    selectedTown = townName;
                    townSelect.property("value", selectedTown);
                    updateAll();
                },
                mouseover: (event) => {
                    mapTooltip
                        .style("display", "block")
                        .style("left", event.originalEvent.pageX + 10 + "px")
                        .style("top", event.originalEvent.pageY - 28 + "px")
                        .html(`
                            <strong>Town:</strong> ${townName}<br/>
                            <strong>Avg Sale:</strong> ${avg ? `$${Math.round(avg).toLocaleString()}` : 'N/A'}<br/>
                            <strong>Sales Ratio:</strong> ${salesRatio !== null ? (salesRatio * 100).toFixed(1) + '%' : 'N/A'}<br/>
                            <strong>Growth Rate:</strong> ${growthRate !== null ? (growthRate * 100).toFixed(1) + '%' : 'N/A'}
                        `);
                },
                mouseout: () => {
                    mapTooltip.style("display", "none");
                }
            });

            // Add town name marker at centroid
            const center = turf.centerOfMass(feature).geometry.coordinates;
            L.marker([center[1], center[0]], {
                icon: L.divIcon({ className: 'town-label', html: townName, iconSize: null })
            }).addTo(window.layerGroup);
        }
    }).addTo(window.layerGroup);
}

// Draw the line chart of average sale price over years
function drawLineChart() {
    const data = window.allData.filter(d => (selectedTown === "All" || d.town === selectedTown) && (selectedYear === "All" || d.year <= selectedYear));

    const yearlyAvg = Array.from(d3.group(data, d => d.year), ([year, vals]) => ({
        year: +year,
        avgSale: d3.mean(vals, d => d.sale_amount)
    })).sort((a, b) => a.year - b.year);

    const x = d3.scaleLinear()
        .domain(d3.extent(yearlyAvg, d => d.year))
        .range([0, lineChartWidth]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(yearlyAvg, d => d.avgSale)]).nice()
        .range([lineChartHeight, 0]);

    lineChartGroup.selectAll("*").remove();

    lineChartGroup.append("g")
        .attr("transform", `translate(0,${lineChartHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    lineChartGroup.append("g")
        .call(d3.axisLeft(y));

    lineChartGroup.append("path")
        .datum(yearlyAvg)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.avgSale)));

    lineChartGroup.selectAll("circle")
        .data(yearlyAvg)
        .join("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.avgSale))
        .attr("r", 4)
        .attr("fill", "orange")
        .on("mouseover", (event, d) => {
            lineChartTooltip.style("display", "block")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 28}px`)
                .html(`Year: ${d.year}<br>Avg Sale: $${Math.round(d.avgSale).toLocaleString()}`);
        })
        .on("mouseout", () => lineChartTooltip.style("display", "none"));
}

// Trigger updates to all visualizations
function updateAll() {
    console.log("updateAll triggered");
    drawMap();
    drawLineChart();
    if (typeof window.updateScatterChart === "function") {
        window.updateScatterChart();
    }
    if (typeof window.updateStackedBarChart === "function") {
        window.updateStackedBarChart(window.allData);
    }
}

window.updateAll = updateAll;
