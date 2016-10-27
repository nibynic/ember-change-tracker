import Ember from 'ember';

export default Ember.Mixin.create({
  store: Ember.inject.service(),

  detectProperties(record) {
    let props = [];
    record.constructor.eachAttribute((name) => {
      props.push(name);
    });
    record.constructor.eachRelationship((name, meta) => {
      if (meta.kind === "belongsTo") {
        props.push(name);
      }
    });
    return props;
  },

  deleteRecord(record) {
    return record.deleteRecord();
  },

  reincarnateRecord(dead) {
    return this.get("store").createRecord(dead.constructor.recordName);
  }
});
