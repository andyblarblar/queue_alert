*[css selector reference](https://www.w3schools.com/cssref/css_selectors.asp)*

# Park formats

*TLDR*: all parks use `nav.panel > a > span:not(.has-text-grey)` to select rides, where odd spans are ride names, and even
spans are the ride states. You must check that the status tags are the next tag after the name, as some rides dont have one.


## Cedar Fair Parks
* `<nav class='panel panel-default'>` marks the start of a section of rides (Coasters, Family, Thrill). `nav.panel` selects these.  
  Skip one div, and the remaining elements in the nav are as follows:
  * a tag with a href of the coaster.
  * a span with the name of the ride.
  * the following span text is either 'Closed', 'Open', or 'num min'.
  * closing a tag
  this is followed by another a tag containing the above.
* Using these rules, `nav.panel > a` iterates over all ride tags, `and nav.panel > a > span` iterates over each ride 
  name followed by its status. This will also get the user reported times span, so you'll have to skip spans with class
  `has-text-grey`. To do this, use: `nav.panel > a > span:not(.has-text-grey)`
* **Final Ride Selector:** `nav.panel > a > span:not(.has-text-grey)`

## Other Parks
All other current parks seem to use the same format, but sometimes dont include the second span. This means you'll 
need to check if the next span is not a time, and account for that.



