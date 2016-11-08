import Ember from "ember";
import EmberDataAdapter from "ember-change-tracker/mixins/change-tracker-ember-data-adapter";

function abstractMethod(name) {
  return function() {
    Ember.assert(`ChangeTracker service must implement ${name} method`, false);
  };
}

export default Ember.Service.extend({

  detectProperties:   abstractMethod("detectProperties"),
  reincarnateRecord:  abstractMethod("reincarnateRecord"),
  deleteRecord:       abstractMethod("deleteRecord")

}, Ember.Evented, EmberDataAdapter, {

  begin(record, ...properties) {
    if (properties.length === 0) {
      properties = this.detectProperties(record);
    }
    let oldSnapshot = this.get("snapshots").get(record) || {};
    let snapshot = Ember.assign(oldSnapshot, record.getProperties(properties));
    this.get("snapshots").set(record, snapshot);
    this.get("actions").set(record, "change");
    this.notifyPropertyChange("hasUncommitedRecords");
  },

  didCreate(record) {
    this.begin(...arguments);
    this.get("actions").set(record, "create");
  },

  didDelete(record) {
    this.begin(...arguments);
    this.get("actions").set(record, "delete");
  },

  commit(...records) {
    let snapshot = [];
    let newProperties, oldProperties, action;
    let snapshots = this.get("snapshots");
    let actions = this.get("actions");

    records.forEach((record) => {
      if (this.detectChanges(record)) {
        oldProperties = snapshots.get(record);
        action = actions.get(record);
        newProperties = record.getProperties(Object.keys(oldProperties));
        snapshot.push([record, action, oldProperties, newProperties]);
      }
      actions.delete(record);
      snapshots.delete(record);
    });

    if (snapshot.length > 0) {
      this.get("undoStack").pushObject(snapshot);
      this.get("redoStack").clear();
      this.triggerEvent("commit", snapshot);
    }
    this.notifyPropertyChange("hasUncommitedRecords");
  },

  rollback(...records) {
    let snapshots = this.get("snapshots");
    let actions = this.get("actions");
    records.forEach((record) => {
      this.undoRecord([record, actions.get(record), snapshots.get(record)]);
      actions.delete(record);
      snapshots.delete(record);
    });
    this.notifyPropertyChange("hasUncommitedRecords");
  },

  undo() {
    let snapshot = this.get("undoStack").popObject();
    for(var i = snapshot.length - 1; i >= 0; i--) {
      this.undoRecord(snapshot[i]);
    }
    this.get("redoStack").pushObject(snapshot);
    this.triggerEvent("undo", snapshot);
  },

  redo() {
    let snapshot = this.get("redoStack").popObject();
    for(var i = 0; i < snapshot.length; i++) {
      this.redoRecord(snapshot[i]);
    }
    this.get("undoStack").pushObject(snapshot);
    this.triggerEvent("redo", snapshot);
  },

  undoRecord(snapshot) {
    switch(snapshot[1]) {
      case "create":
        this.deleteRecord(snapshot[0]);
        break;
      case "delete":
        snapshot[0] = this.reincarnate(snapshot[0]);
        /* falls through */
      default:
        snapshot[0].setProperties(snapshot[2]);
    }
  },

  redoRecord(snapshot) {
    switch(snapshot[1]) {
      case "delete":
        this.deleteRecord(snapshot[0]);
        break;
      case "create":
        snapshot[0] = this.reincarnate(snapshot[0]);
        /* falls through */
      default:
        snapshot[0].setProperties(snapshot[3]);
    }
  },

  triggerEvent(action, snapshot) {
    let records = snapshot.map((i) => { return i[0]; });
    this.trigger("change", action, records);
    if (action !== "commit") {
      this.trigger(action, records);
    }
  },

  reincarnate(dead) {
    let alive = this.reincarnateRecord(dead);

    function replaceDead(record) {
      record = record.hasOwnProperty("isFulfilled") ? record.get("content") : record;
      return record === dead ? alive : record;
    }

    function fixSnapshot(snapshot) {
      snapshot[0] = replaceDead(snapshot[0]);
      var key;
      for (key in snapshot[2]) {
        snapshot[2][key] = replaceDead(snapshot[2][key]);
      }
      for (key in snapshot[3]) {
        snapshot[3][key] = replaceDead(snapshot[3][key]);
      }
    }

    this.get("undoStack").map(fixSnapshot);
    this.get("redoStack").map(fixSnapshot);

    this.get("snapshots")

    return alive;
  },

  detectChanges(record) {
    let action = this.get("actions").get(record);
    if (action === "create" || action === "delete") {
      return true;
    }
    let was = this.get("snapshots").get(record);
    if (was) {
      let is = record.getProperties(...Object.keys(was));
      for (var key in was) {
        if (was[key] !== is[key]) {
          return true;
        }
      }
    }
    return false;
  },


  undoAvailable: Ember.computed("undoStack.length", function() {
    return this.get("undoStack.length") > 0;
  }),

  redoAvailable: Ember.computed("redoStack.length", function() {
    return this.get("redoStack.length") > 0;
  }),

  hasUncommitedRecords: Ember.computed(function() {
    return this.get("snapshots.size") > 0;
  }),


  snapshots: Ember.computed(function() {
    return Ember.Map.create();
  }),

  actions: Ember.computed(function() {
    return Ember.Map.create();
  }),

  undoStack: Ember.computed(function() {
    return Ember.A();
  }),

  redoStack: Ember.computed(function() {
    return Ember.A();
  })
});
