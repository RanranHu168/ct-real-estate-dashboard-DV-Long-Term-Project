// Initialize SVG and layout settings for scatter plot
const scatterSvg = d3.select("#scatterPlot"),
    scatterMargin = { top: 40, right: 30, bottom: 60, left: 90 },
    scatterWidth = +scatterSvg.attr("width") - scatterMargin.left - scatterMargin.right,
    scatterHeight = +scatterSvg.attr("height") - scatterMargin.top - scatterMargin.bottom,
    scatterChart = scatterSvg.append("g").attr("transform", `translate(${scatterMargin.left},${scatterMargin.top})`);

const scatterXAxis = scatterChart.append("g")
    .attr("transform", `translate(0,${scatterHeight})`);
const scatterYAxis = scatterChart.append("g");

const scatterTooltip = d3.select("#scatterTooltip");

// Initialize the Property Type dropdown menu
const residentialTypes = ["Apartments", "Condos", "Four Family", "Single Family", "Two Family", "Three Family"];
const typeOptions = ["All", "Residential", "Commercial"];
typeOptions.forEach(t => d3.select("#typeSelect").append("option").attr("value", t).text(t));

// Register dropdown change event to update scatter chart
d3.select("#typeSelect").on("change", () => {
    window.updateScatterChart();
});

// Directly define updateScatterChart and use allData from global scope.No need to load CSV here!

window.updateScatterChart = function() {
    if (!window.allData || window.allData.length === 0) {
        console.log("Waiting for allData to be ready...");
        //Add retry if data is not yet ready
        setTimeout(window.updateScatterChart, 200); // Retry after 200ms
        return;
    }

    const selectedTown = document.getElementById("townSelect").value;
    const selectedType = document.getElementById("typeSelect").value;
    const selectedYear = document.getElementById("yearSelect").value;

    let filtered = window.allData;

    if (selectedTown !== "All") filtered = filtered.filter(d => d.town === selectedTown);
    if (selectedType !== "All") filtered = filtered.filter(d => d.type === selectedType);
    if (selectedYear !== "All") filtered = filtered.filter(d => d.year === +selectedYear);

    filtered = filtered.filter(d => !isNaN(d.assessed) && !isNaN(d.sale_amount) && d.assessed >= 0 && d.sale_amount >= 0);

    const x = d3.scaleLinear().range([0, scatterWidth]);
    const y = d3.scaleLinear().range([scatterHeight, 0]);

    const color = d3.scaleSequential()
        .domain(d3.extent(filtered, d => d.year))
        .interpolator(d3.interpolateViridis);

    if (filtered.length === 0) {
        scatterChart.selectAll(".dot").remove();
        return;
    }

    x.domain([0, d3.max(filtered, d => d.assessed) * 1.1]);
    y.domain([0, d3.max(filtered, d => d.sale_amount) * 1.1]);

    scatterXAxis.call(d3.axisBottom(x));
    scatterYAxis.call(d3.axisLeft(y));

    scatterChart.selectAll(".dot").data(filtered, d => d.assessed + '-' + d.sale_amount)
        .join(
            enter => enter.append("circle").attr("class", "dot")
                .attr("cx", d => x(d.assessed))
                .attr("cy", d => y(d.sale_amount))
                .attr("r", 5)
                .attr("fill", d => color(d.year))
                .on("mouseover", (event, d) => {
                    scatterTooltip
                        .style("display", "block")
                        .transition().duration(200).style("opacity", 0.9);
                    scatterTooltip.html(
                        `Town: ${d.town}<br>
                Type: ${d.type}<br>
                Year: ${d.year}<br>
                Assessed: $${Math.round(d.assessed).toLocaleString()}<br>
                Sale: $${Math.round(d.sale_amount).toLocaleString()}`
                    )
                        .style("left", event.pageX + 15 + "px")
                        .style("top", event.pageY - 28 + "px");
                })
                .on("mouseout", () => {
                    scatterTooltip
                        .transition().duration(300)
                        .style("opacity", 0)
                        .on("end", () => {
                            scatterTooltip.style("display", "none");
                        });
                }),

            update => update
                .transition().duration(500)
                .attr("cx", d => x(d.assessed))
                .attr("cy", d => y(d.sale_amount))
                .attr("fill", d => color(d.year)),

            exit => exit.transition().duration(300).attr("r", 0).remove()
        );

};

//  After page load and allData is ready, updateAll() will be triggered, which calls updateScatterChart
