const ss = SpreadsheetApp.getActiveSpreadsheet();
const ratingTab = ss.getSheetByName("rating");
const gameTab = ss.getSheetByName("game results");

function updateVolatility(phi, tau, x, v, delta, a) { // f
  ans = Math.exp(x) * (Math.pow(delta, 2) - Math.pow(phi, 2) - v - Math.exp(x));
  ans /= (2 * Math.pow(Math.pow(phi, 2) + v + (Math.exp(x), 2), 2));
  ans -= ((x-a) / Math.pow(tau, 2));
  return ans;
}

function g_func(phi) {
  return 1 / Math.sqrt(1 + 3 * Math.pow(phi, 2) / Math.pow(Math.PI, 2));
}

function e_func(mu, other_mu, other_phi) {
  return 1 / (1 + Math.exp(-g_func(other_phi) * (mu - other_mu)));
}

function getNewRating(mu, phi, sigma, tau, epsilon, opp_mu, opp_phi, team_mu, team_phi, score) {
  // score is 1/0, opp mu/phi is average

  // 3
  // let g = g_func(opp_phi) + g_func(team_phi);
  // let e = 1 / Math.sqrt(1 + Math.exp(-g) * (mu - opp_mu));
  let v = 1 / (Math.pow(g_func(opp_phi), 2) * e_func(mu, opp_mu, opp_phi) + Math.pow(g_func(team_mu), 2) * e_func(mu, team_mu, team_phi));

  // 4 
  let delta = v * (g_func(opp_phi) * (score-e_func(mu, opp_mu, opp_phi)) + g_func(team_phi) * (0.5-e_func(mu, team_mu, team_phi)));

  // 5
  let a = Math.log(Math.pow(sigma, 2));
  let aa = a;
  let b = 0;
  if (Math.pow(delta, 2) > (Math.pow(phi, 2) + v)) b = Math.log(Math.pow(delta, 2) - Math.pow(phi, 2) - v);
  else {
    let k = 1;
    while (updateVolatility(phi, tau, a-k*tau, v, delta, a) < 0) k += 1;
    b = a-k*tau;
  }

  let fA = updateVolatility(phi, tau, aa, v, delta, a);
  let fB = updateVolatility(phi, tau, b, v, delta, a);

  while (Math.abs(b-aa) > epsilon) {
    var c = aa + (aa-b) * fA / (fB - fA);
    var fC = updateVolatility(phi, tau, c, v, delta, a);
    if (fC * fB <= 0) {
      aa = b;
      fA = fB;
    } else fA /= 2;
    b = c;
    fB = fC;
  }

  let new_sigma = Math.exp(aa/2);

  // 6
  let new_phi = Math.sqrt(Math.pow(phi, 2) + Math.pow(new_sigma, 2));

  new_phi = 1 / Math.sqrt(1 / Math.pow(new_phi, 2) + 1/v);
  let new_mu = mu + Math.pow(new_phi, 2) * (g_func(opp_phi) * (score - e_func(mu, opp_mu, opp_phi) + g_func(team_phi) * (0.5 - e_func(mu, team_mu, team_phi))));

  let new_rating = 50 + 7.5 * (new_mu - 2 * new_phi);

  // Logger.log(new_rating, new_mu, new_phi, new_sigma);

  return [new_rating, new_mu, new_phi, new_sigma];
}

function getPlayerRow(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ratingTab = ss.getSheetByName("rating");
  for (j=1; j<ratingTab.getLastRow()+1; j++) {
    if (ratingTab.getRange('A'+j.toString()).getValue() == name) return j;
  }
}

function updateRating(tau, epsilon, opp_mu, opp_phi, team_mu, team_phi, row, score) {
  let cur_mu = ratingTab.getRange('C'+(row).toString()).getValue();
  let cur_phi = ratingTab.getRange('D'+(row).toString()).getValue();
  let cur_sigma = ratingTab.getRange('E'+(row).toString()).getValue();
  return getNewRating(cur_mu, cur_phi, cur_sigma, tau, epsilon, opp_mu, opp_phi, team_mu, team_phi, score);
}

function updateSS() {
  var tau = 0.2;
  var epsilon = 0.000001;
  var last_row = ratingTab.getRange('H1').getValue();
  if (last_row == gameTab.getLastRow()) {
    // done
    Logger.log("Done!");
    return;
  }
  var hitler = gameTab.getRange('B'+(last_row+2).toString()).getValue();
  var hitler_row = getPlayerRow(hitler);
  var fascs = gameTab.getRange('B'+(last_row+3).toString()).getValue();
  var libs = gameTab.getRange('B'+(last_row+4).toString()).getValue();
  var winner = gameTab.getRange('C'+(last_row+2).toString()).getValue();

  var fascs_list = fascs.split(', ');
  var fascs_row = [];
  for (i=0; i<fascs_list.length; i++) fascs_row.push(getPlayerRow(fascs_list[i]));
  var avg_fasc_mu = 0;
  var avg_fasc_phi = 0;
  for (i=0; i<fascs_row.length; i++) {
    avg_fasc_mu += ratingTab.getRange('C'+(fascs_row[i]).toString()).getValue();
    avg_fasc_phi += ratingTab.getRange('D'+(fascs_row[i]).toString()).getValue();
  }
  avg_fasc_mu /= fascs_list.length;
  avg_fasc_phi /= fascs_list.length;

  var libs_list = libs.split(', ');
  var libs_row = [];
  var avg_lib_mu = 0;
  var avg_lib_phi = 0;
  for (i=0; i<libs_list.length; i++) libs_row.push(getPlayerRow(libs_list[i]));
  for (i=0; i<libs_row.length; i++) {
    avg_lib_mu += ratingTab.getRange('C'+(libs_row[i]).toString()).getValue();
    avg_lib_phi += ratingTab.getRange('D'+(libs_row[i]).toString()).getValue();
  }
  avg_lib_mu /= libs_list.length;
  avg_lib_phi /= libs_list.length;

  var upd_ratings = {}; // dictionary
  if (winner == 'F') { // fascist win
    upd_ratings[hitler_row] = updateRating(tau, epsilon, avg_lib_mu, avg_lib_phi, avg_fasc_mu, avg_fasc_phi, hitler_row, 1);
    for (i=0; i<fascs_row.length; i++) upd_ratings[fascs_row[i]] = updateRating(tau, epsilon, avg_lib_mu, avg_lib_phi, avg_fasc_mu, avg_fasc_phi, fascs_row[i], 1);
    for (i=0; i<libs_row.length; i++) upd_ratings[libs_row[i]] = updateRating(tau, epsilon, avg_fasc_mu, avg_fasc_phi, avg_lib_mu, avg_lib_phi, libs_row[i], 0); 
  }
  else { // lib win
    upd_ratings[hitler_row] = updateRating(tau, epsilon, avg_lib_mu, avg_lib_phi, avg_fasc_mu, avg_fasc_phi, hitler_row, 0);
    for (i=0; i<fascs_row.length; i++) upd_ratings[fascs_row[i]] = updateRating(tau, epsilon, avg_lib_mu, avg_lib_phi, avg_fasc_mu, avg_fasc_phi, fascs_row[i], 0);
    for (i=0; i<libs_row.length; i++) upd_ratings[libs_row[i]] = updateRating(tau, epsilon, avg_fasc_mu, avg_fasc_phi, avg_lib_mu, avg_lib_phi, libs_row[i], 1); 
  }

  let k = Object.keys(upd_ratings);
  for (i=0; i<k.length; i++) {
    // ratingTab.getRange('B'+k[i].toString()).setValue(upd_ratings[k[i]][0]);
    ratingTab.getRange('C'+k[i].toString()).setValue(upd_ratings[k[i]][1]);
    ratingTab.getRange('D'+k[i].toString()).setValue(upd_ratings[k[i]][2]);
    ratingTab.getRange('E'+k[i].toString()).setValue(upd_ratings[k[i]][3]);
  }
  ratingTab.getRange('H1').setValue(last_row+4);
  // Logger.log(hitler_row);
  // Logger.log(fascs_list);
  // Logger.log(fascs_list.length);
  // Logger.log(fascs_row);
  // Logger.log(libs_list);
  // Logger.log(libs_row);
  // Logger.log(k);
  // Logger.log(upd_ratings);

}