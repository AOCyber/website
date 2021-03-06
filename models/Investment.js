/**
 * Created by justin on 5/4/16.
 */

var eden = require('edencms');
var Types = eden.Field.Types;
var Client = require('coinbase').Client;
var client = new Client({
	'apiKey': process.env.CB_API_KEY,
	'apiSecret': process.env.CB_API_SECRET
});

var Investment = new eden.List('Investment');

Investment.add({
	investor: {
		type: Types.Relationship,
		ref: 'User',
		initial: true
	},
	currency: {
		type: Types.Select,
		options: 'BTC, BCH, ETH, LTC, USD',
		initial: true
	},
	address: {
		type: String,
		initial: true
	},
	amount: {
		type: Types.Number,
		initial: true
	},
	type: {
		type: Types.Select,
		options: 'Investment, Referral Bonus, Bonus, Bounty',
		initial: true
	},
	usdValue: {
		type: Types.Money,
		initial: true
	},
	totalValue: {
		type: Types.Money,
		initial: true
	},
	tokenPrice: {
		type: Types.Money
	},
	tokenPurchased: {
		type: Types.Number
	},
	confirmed: {
		type: Boolean,
		initial: true
	},
	transID: {
		type: String,
		initial: true
	},
	createdAt: {
		type: Types.Datetime,
		default: Date.now,
		noedit: true
	},
});


Investment.schema.post('save', function () {
	var id = this.id;
	var amount = this.amount;
	var currency = this.currency;
	var type = this.type;
	var tokenPrice = this.tokenPrice;
	var tokenPurchased = this.tokenPurchased;

	if (this.amount / this.usdValue !== this.totalValue) {
		eden.list('User').model.findOne({
			_id: this.investor
		}, function (err, user) {
			if (err) {
				console.log(err);
			}

			client.getExchangeRates({
				'currency': 'USD'
			}, function (err, rates) {
				if (err) {
					console.log(err);
				}
				var rate = rates.data.rates;
				rate = rate[currency];
				Investment.model.findOne({
					_id: id
				}, function (findError, investment) {
					if (findError) {
						// console.log(findError);
					} else {
						investment.usdValue = rate;
						investment.totalValue = amount / rate;
						eden.list('Token').model.findOne({
							remaining: {
								$gt: 0
							}
						}).sort({
							remaining: 1
						}).exec(function (err, availableToken) {
							if (err) {
								console.log(err);
							} else {
								if (investment.totalValue / availableToken.price > availableToken.remaining) {} else {
									investment.tokenPrice = availableToken.price;
									investment.tokenPurchased = parseInt(parseFloat(investment.totalValue) / parseFloat(investment.tokenPrice));
									availableToken.remaining = availableToken.remaining - investment.tokenPurchased;
									availableToken.save();
									investment.save(function (err) {
										if (err) {
											//console.log(err);
										}
										if (type === 'Investment') {
											switch (currency) {
												case 'BTC':
													user.investedBTC = parseFloat(user.investedBTC) + parseFloat(amount);
													user.investedBTC = user.investedBTC.toPrecision(9);
													eden.list('Setting').model.findOne({
														key: "btcAmount"
													}, function (err, btcAmount) {
														if (err) {
															console.log(err);
														} else {
															btcAmount.value = parseFloat(btcAmount.value) + parseFloat(amount);
															btcAmount.save();
														}
													});
													break;
												case 'BCH':
													user.investedBCH = parseFloat(user.investedBCH) + parseFloat(amount);
													user.investedBCH = user.investedBCH.toPrecision(9);
													eden.list('Setting').model.findOne({
														key: "bchAmount"
													}, function (err, bchAmount) {
														if (err) {
															console.log(err);
														} else {
															bchAmount.value = parseFloat(bchAmount.value) + parseFloat(amount);
															bchAmount.save();
														}
													});
													break;
												case 'ETH':
													user.investedETH = parseFloat(user.investedETH) + parseFloat(amount);
													user.investedETH = user.investedETH.toPrecision(9);
													eden.list('Setting').model.findOne({
														key: "ethAmount"
													}, function (err, ethAmount) {
														if (err) {
															console.log(err);
														} else {
															ethAmount.value = parseFloat(ethAmount.value) + parseFloat(amount);
															ethAmount.save();
														}
													});
													break;
												case 'LTC':
													user.investedLTC = parseFloat(user.investedLTC) + parseFloat(amount);
													user.investedLTC = user.investedLTC.toPrecision(9);
													eden.list('Setting').model.findOne({
														key: "ltcAmount"
													}, function (err, ltcAmount) {
														if (err) {
															console.log(err);
														} else {
															ltcAmount.value = parseFloat(ltcAmount.value) + parseFloat(amount);
															ltcAmount.save();
														}
													});
													break;

												default:
													break;
											}
											user.totalUSD += investment.totalValue;
											user.totalAOC += investment.tokenPurchased;
											user.totalUSD = user.totalUSD.toFixed(2);
											eden.list('Setting').model.findOne({
												key: "marketCap"
											}, function (err, marketCap) {
												if (err) {
													console.log(err);
												} else {
													marketCap.value = parseFloat(marketCap.value) + parseFloat(investment.totalValue);
													marketCap.save();
												}
											});
											eden.list('Setting').model.findOne({
												key: "coinReserved"
											}, function (err, coinReserved) {
												if (err) {
													console.log(err);
												} else {
													coinReserved.value = parseInt(coinReserved.value) + parseInt(investment.tokenPurchased);
													coinReserved.save();
												}
											});
										}
										if (type === 'Referral Bonus') {
											var refBonus = amount / investment.usdValue;
											console.log(refBonus);
											user.referralBonus += refBonus;
											console.log(user.referralBonus);
											user.referralBonus = user.referralBonus.toFixed(2);
											user.referredUSD = (user.referralBonus / .05).toFixed(2);
										}
										user.save(function (err) {
											if (err) {
												console.log(err);
											}
										});
									});
								}
							}
						});
					}

				});
			});
		});
	}
});

Investment.schema.post('remove', function (next) {
	var id = this.id;
	var amount = this.amount;
	var currency = this.currency;
	var type = this.type;
	var tokenPrice = this.tokenPrice;
	var tokenPurchased = this.tokenPurchased;
	var usdValue = this.usdValue;
	var totalValue = this.totalValue;

	eden.list('User').model.findOne({
		_id: this.investor
	}, function (err, user) {
		if (err) {
			console.log(err);
			next();
		} else {
			eden.list('Token').model.findOne({
				remaining: {
					$gt: 0
				}
			}).sort({
				remaining: 1
			}).exec(function (err, availableToken) {
				if (err) {
					console.log(err);
					next();
				} else {
					availableToken.remaining = availableToken.remaining + tokenPurchased
					availableToken.save();
					if (type === 'Investment') {
						switch (currency) {
							case 'BTC':
								user.investedBTC = parseFloat(user.investedBTC) - parseFloat(amount);
								user.investedBTC = user.investedBTC.toPrecision(9);
								eden.list('Setting').model.findOne({
									key: "btcAmount"
								}, function (err, btcAmount) {
									if (err) {
										console.log(err);
									} else {
										btcAmount.value = parseFloat(btcAmount.value) - parseFloat(amount);
										btcAmount.save();
									}
								});
								break;
							case 'BCH':
								user.investedBCH = parseFloat(user.investedBCH) - parseFloat(amount);
								user.investedBCH = user.investedBCH.toPrecision(9);
								eden.list('Setting').model.findOne({
									key: "bchAmount"
								}, function (err, bchAmount) {
									if (err) {
										console.log(err);
									} else {
										bchAmount.value = parseFloat(bchAmount.value) - parseFloat(amount);
										bchAmount.save();
									}
								});
								break;
							case 'ETH':
								user.investedETH = parseFloat(user.investedETH) - parseFloat(amount);
								user.investedETH = user.investedETH.toPrecision(9);
								eden.list('Setting').model.findOne({
									key: "ethAmount"
								}, function (err, ethAmount) {
									if (err) {
										console.log(err);
									} else {
										ethAmount.value = parseFloat(ethAmount.value) - parseFloat(amount);
										ethAmount.save();
									}
								});
								break;
							case 'LTC':
								user.investedLTC = parseFloat(user.investedLTC) - parseFloat(amount);
								user.investedLTC = user.investedLTC.toPrecision(9);
								eden.list('Setting').model.findOne({
									key: "ltcAmount"
								}, function (err, ltcAmount) {
									if (err) {
										console.log(err);
									} else {
										ltcAmount.value = parseFloat(ltcAmount.value) - parseFloat(amount);
										ltcAmount.save();
									}
								});
								break;

							default:
								break;
						}
						user.totalUSD = user.totalUSD - totalValue;
						user.totalAOC = user.totalAOC - tokenPurchased;
						user.totalUSD = user.totalUSD.toFixed(2);
						eden.list('Setting').model.findOne({
							key: "marketCap"
						}, function (err, marketCap) {
							if (err) {
								console.log(err);
								next();
							} else {
								marketCap.value = parseFloat(marketCap.value) - parseFloat(totalValue);
								marketCap.save();
							}
						});
						eden.list('Setting').model.findOne({
							key: "coinReserved"
						}, function (err, coinReserved) {
							if (err) {
								console.log(err);
								next();
							} else {
								coinReserved.value = parseInt(coinReserved.value) - parseInt(tokenPurchased);
								coinReserved.save();
							}
						});
					}
					if (type === 'Referral Bonus') {
						var refBonus = amount / usdValue;
						user.referralBonus = user.referralBonus - refBonus;
						user.referralBonus = user.referralBonus.toFixed(2);
						user.referredUSD = (user.referralBonus / user.referralPercent).toFixed(2);
					}
					user.save(function (err) {
						if (err) {
							console.log(err);
							next();
						}
					});
				}
			});
		}
	});
});



Investment.defaultColumns = 'investor, currency, amount, totalValue, type, confirmed';
Investment.register();
