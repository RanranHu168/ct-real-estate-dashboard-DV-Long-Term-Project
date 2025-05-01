// Select the SVG element and define margins and dimensions
const stackedSvg = d3.select("#stackedBarChart");
const stackedMargin = { top: 40, right: 30, bottom: 60, left: 150 };
const stackedWidth = +stackedSvg.attr("width") - stackedMargin.left - stackedMargin.right;
let stackedHeight = 500;

const stackedChart = stackedSvg.append("g")
    .attr("transform", `translate(${stackedMargin.left},${stackedMargin.top})`);

// Tooltip for bars
const barTooltip = d3.select("#barTooltip");

function updateStackedBarChart(data) {
  console.log("---- Inside updateStackedBarChart ----");
  stackedSvg.selectAll("*").remove();

  const chartGroup = stackedSvg.append("g")
      .attr("transform", `translate(${stackedMargin.left},${stackedMargin.top})`);

  console.log("Selected Year:", selectedYear);
  console.log("Selected Town:", selectedTown);
  console.log("Incoming data length:", data.length);

  if (!data || data.length === 0) {
    console.log("No data for bar chart.");
    return;
  }


  // Filter data based on selected year and town
  let filteredData = data;

  if (selectedYear !== "All") {
    filteredData = filteredData.filter(d => d.year === +selectedYear);
  }
  if (selectedTown !== "All") {
    filteredData = filteredData.filter(d => d.town === selectedTown);
  }

  console.log("Filtered data length:", filteredData.length);

  const grouped = d3.rollups(
      filteredData,
      v => {
        let res = 0, com = 0;
        v.forEach(d => {
          if (d.type === "Residential") res++;
          else if (d.type === "Commercial") com++;
        });
        return { Residential: res, Commercial: com };
      },
      d => d.town
  );

  const stackedData = grouped.map(([town, counts]) => ({
    town,
    Residential: counts.Residential,
    Commercial: counts.Commercial
  })).filter(d => d.Residential > 0 || d.Commercial > 0);

  if (stackedData.length === 0) return;

  const townsVisibleBeforeScroll = 20;
  stackedHeight = Math.max(townsVisibleBeforeScroll * 30, stackedData.length * 30);
  stackedSvg.attr("height", stackedHeight + stackedMargin.top + stackedMargin.bottom);

  const keys = ["Residential", "Commercial"];

  const y = d3.scaleBand()
      .domain(stackedData.map(d => d.town))
      .range([0, stackedHeight])
      .padding(0.2);

  const x = d3.scaleLinear()
      .domain([0, d3.max(stackedData, d => d.Residential + d.Commercial)]).nice()
      .range([0, stackedWidth]);

  const color = d3.scaleOrdinal()
      .domain(keys)
      .range(["#4daf4a", "#377eb8"]);

  const stackedSeries = d3.stack()
      .keys(keys)(stackedData);

  chartGroup.append("g")
      .selectAll("g")
      .data(stackedSeries)
      .join("g")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d)
      .join("rect")
      .attr("y", d => y(d.data.town))
      .attr("x", d => x(d[0]))
      .attr("width", d => x(d[1]) - x(d[0]))
      .attr("height", y.bandwidth())
      .on("mouseover", (event, d) => {
        barTooltip.style("display", "block")
            .html(`
          <strong>Town:</strong> ${d.data.town}<br/>
          <strong>Residential Sales:</strong> ${d.data.Residential}<br/>
          <strong>Commercial Sales:</strong> ${d.data.Commercial}
        `);
      })
      .on("mousemove", event => {
        barTooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        barTooltip.style("display", "none");
      })
      .transition()
      .duration(800);

  chartGroup.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "10px");

  chartGroup.append("g")
      .attr("transform", `translate(0,${stackedHeight})`)
      .call(d3.axisBottom(x));

  const titleText = (selectedTown !== "All")
      ? `Sales in ${selectedTown}`
      : "Sales in All Towns";

  stackedSvg.append("text")
      .attr("x", (stackedWidth + stackedMargin.left + stackedMargin.right) / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(titleText);
}

// Expose updateStackedBarChart to global scope for external use
window.updateStackedBarChart = updateStackedBarChart;