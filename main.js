
const map = L.map("map").setView([41.6, -72.7], 8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

map._initPathRoot();
const svg = d3.select("#map").select("svg");
const g = svg.append("g");
const tooltip = d3.select("#tooltip");

const colorScales = {
  avg_price: d3.scaleSequential(d3.interpolateOranges),
  growth_rate: d3.scaleSequential(d3.interpolateRdYlGn),
  sales_ratio: d3.scaleSequential(d3.interpolateBlues)
};

let geoData, summaryData;

Promise.all([
  d3.json("CTDOT_Municipalities.geojson"),
  d3.csv("town_data_by_year.csv", d => ({
    town: d.Town.trim().toLowerCase(),
    year: +d["List Year"],
    sale_amount: +d["Sale Amount"],
    assessed_value: +d["Assessed Value"],
    sales_ratio: +d["Sales Ratio"]
  }))
]).then(([geo, data]) => {
  geoData = geo;

  const nested = d3.group(data, d => d.year, d => d.town);
  summaryData = [];
  nested.forEach((townMap, year) => {
    townMap.forEach((records, town) => {
      const avg_price = d3.sum(records, r => r.sale_amount) / records.length;
      const sales_ratio = d3.mean(records, r => r.sales_ratio);
      summaryData.push({ year, town, avg_price, sales_ratio, growth_rate: null });
    });
  });

  const years = Array.from(new Set(summaryData.map(d => d.year))).sort();
  d3.select("#year")
    .selectAll("option")
    .data(years)
    .join("option")
    .text(d => d)
    .attr("value", d => d);

  d3.selectAll("select").on("change", drawMap);
  drawMap();
});

function projectPoint(x, y) {
  const point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

function drawMap() {
  const selectedYear = +d3.select("#year").property("value");
  const selectedMetric = d3.select("#metric").property("value");
  const yearData = summaryData.filter(d => d.year === selectedYear);
  const color = colorScales[selectedMetric].domain(d3.extent(yearData.map(d => d[selectedMetric])));

  const dataMap = new Map(yearData.map(d => [d.town, d]));
  const transform = d3.geoTransform({ point: projectPoint });
  const path = d3.geoPath().projection(transform);

  const features = g.selectAll("path").data(geoData.features);
  features.join("path")
    .attr("d", path)
    .attr("fill", d => {
      const town = d.properties?.Municipality?.toLowerCase();
      const val = dataMap.get(town)?.[selectedMetric];
      return val != null ? color(val) : "#ccc";
    })
    .attr("stroke", "#fff")
    .on("mouseover", (event, d) => {
      const town = d.properties?.Municipality;
      const info = dataMap.get(town?.toLowerCase());
      tooltip.style("display", "block")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px")
        .html(`<strong>${town}</strong><br>
          Avg Price: $${info?.avg_price?.toFixed(0) || 'N/A'}<br>
          Sales Ratio: ${info?.sales_ratio?.toFixed(2) || 'N/A'}<br>
          Growth Rate: ${info?.growth_rate != null ? info.growth_rate.toFixed(2) + '%' : 'N/A'}`);
    })
    .on("mouseout", () => tooltip.style("display", "none"));

  map.on("zoomend", () => {
    g.selectAll("path").attr("d", path);
  });
}
