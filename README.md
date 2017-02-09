# Ember Change Tracker

Ember Addon providing undo/redo mechanism and change detection. By default it works with Ember Data, but can be easily extended for other persistence libraries.

## Installation

```
ember install ember-change-tracker
```

## Usage

### Basic flow

Inject `change-tracker` service in your route/controller/component:

```
changeTracker: Ember.inject.service()
```

#### Start tracking

Before you allow user to make changes in data, tell Ember Change Tracker to observe affected records. At this stage Ember Change Tracker will create a snapshot of your data and store for comparing in the future.

```
this.get("changeTracker").begin(this.get("model"), "firstName", "lastName");
```

The first argument is required and it's the object you'd like to have tracked. After the object you can pass names of the properties you'd like to have tracked (optional). If you don't provide them all object properties will be used.

Alternatively you can use `didCreate` or `didDelete` methods with the same arguments as above, to tell Ember Change Tracker that record was created or deleted.

#### Accept or reject changes

When user accepts changes (e.g. clicks submit button):

```
this.get("changeTracker").commit(this.get("model"));
```

When user rejects changes (e.g. clicks cancel button):

```
this.get("changeTracker").rollback(this.get("model"));
```

In both methods you can pass multiple objects as arguments to commit or rollback them in one operation (this is important in undo/redo mechanism).

### Undo/redo

Every time you call `commit` method, Ember Change Tracker stores this operation in undo history.

```
let model = this.get("model");
let changeTracker = this.get("changeTracker");
changeTracker.begin(model, "firstName", "lastName");
model.set("firstName", "John");
changeTracker.commit(model);
```

You can check if undo is available and undo changes:

```
changeTracker.get("undoAvailable"); // true
changeTracker.undo();
```

Then redo is available:

```
changeTracker.get("redoAvailable"); // true
changeTracker.redo();
```

### Detecting uncommited changes

In some situations you'd like to notify user that their data is not saved and could be lost. Ember Change Tracker makes it quite simple:

```
this.get("changeTracker").checkForChangedRecords(); // Boolean
```

This method will return true if there is any changed property in uncommited records.

For less performance impactful detection you can use this computed property:

```
this.get("changeTracker.hasUncommitedRecords");
```

This won't compare records properties, just check if there are any records that should be commited or rollbacked.

### Using with other persistence libraries

Bu default Ember Change Tracker works with Ember Data. If you'd like to use other persistence library, just extend `change-tracker` service and define these 3 methods:

```
import ChangeTracker from "ember-change-tracker/services/change-tracker";

export default ChangeTracker.extend({
  detectProperties(record) {
    // return array of record properties names
  },

  deleteRecord(record) {
    // destroy record
  },

  reincarnateRecord(dead) {
    // create and return an empty record of the same type as provided dead record
  }
});
```

For inspiration take a look at [ChangeTrackerEmberDataAdapterMixin](https://github.com/nibynic/ember-change-tracker/blob/master/addon/mixins/change-tracker-ember-data-adapter.js).

## Legal

[nibynic](http://nibynic.com) &copy; 2015

[Licensed under the MIT license](http://www.opensource.org/licenses/mit-license.php)
